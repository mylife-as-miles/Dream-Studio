import {
  parseWebHammerEngineBundleZip,
  parseWebHammerEngineScene,
  createWebHammerBundleAssetResolver,
  createWebHammerSceneObjectFactory,
  applyWebHammerWorldSettings,
  clearWebHammerWorldSettings,
  type WebHammerEngineScene
} from "@blud/three-runtime";
import { resolveSceneGraph, normalizeSceneSettings } from "@blud/shared";
import {
  AmbientLight,
  Box3,
  Clock,
  Color,
  Group,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Minimal runtime playground.
 *
 * Loads a runtime bundle or manifest, creates Three.js objects via the
 * adapter, and renders them with orbit controls. No physics, no gameplay
 * systems, no audio — just the scene.
 */
export function createPlayground(root: HTMLElement) {
  return new Playground(root);
}

class Playground {
  private readonly camera = new PerspectiveCamera(60, 1, 0.1, 2000);
  private readonly clock = new Clock();
  private readonly controls: OrbitControls;
  private readonly fileInput: HTMLInputElement;
  private readonly renderer = new WebGLRenderer({ antialias: true });
  private readonly resizeObserver: ResizeObserver;
  private readonly scene = new Scene();
  private readonly worldRoot = new Group();

  private bundleResolver?: ReturnType<typeof createWebHammerBundleAssetResolver>;
  private frameHandle = 0;
  private loadVersion = 0;

  constructor(root: HTMLElement) {
    // Shell
    root.innerHTML = `
      <div style="position:relative;width:100%;height:100vh;background:#0b1015;color:#e2e8f0;font-family:system-ui,sans-serif">
        <canvas data-canvas style="position:absolute;inset:0;width:100%;height:100%"></canvas>
        <div style="position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:10;display:flex;gap:8px">
          <button data-action="import" style="padding:6px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(15,23,42,0.8);color:#e2e8f0;cursor:pointer;font-size:13px">Import</button>
        </div>
        <div data-status style="position:absolute;bottom:16px;left:16px;z-index:10;font-size:12px;opacity:0.6"></div>
      </div>
    `;

    const canvas = root.querySelector("[data-canvas]") as HTMLCanvasElement;
    const statusEl = root.querySelector("[data-status]") as HTMLDivElement;

    this.fileInput = document.createElement("input");
    this.fileInput.type = "file";
    this.fileInput.accept = ".zip,.json,.whmap";
    this.fileInput.style.display = "none";
    root.append(this.fileInput);

    // Renderer
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.setClearColor("#0b1015");
    this.scene.add(this.worldRoot);

    // Camera + controls
    this.camera.position.set(12, 8, 12);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0);

    // Resize
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement!);
    this.resize();

    // Events
    root.querySelector('[data-action="import"]')!.addEventListener("click", () => this.fileInput.click());
    this.fileInput.addEventListener("change", async () => {
      const file = this.fileInput.files?.[0];
      if (!file) return;
      this.fileInput.value = "";
      statusEl.textContent = `Loading ${file.name}…`;
      try {
        await this.importFile(file);
        statusEl.textContent = file.name;
      } catch (err) {
        statusEl.textContent = `Error: ${err instanceof Error ? err.message : "import failed"}`;
      }
    });

    // Render loop
    this.frameHandle = requestAnimationFrame(this.tick);
    statusEl.textContent = "Import a .zip, .json, or .whmap file";
  }

  private async importFile(file: File) {
    const version = ++this.loadVersion;
    let scene: WebHammerEngineScene;
    let resolveAssetPath: (path: string) => Promise<string> | string = (p) => p;

    if (file.name.toLowerCase().endsWith(".zip")) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const bundle = parseWebHammerEngineBundleZip(bytes);
      this.bundleResolver?.dispose();
      this.bundleResolver = createWebHammerBundleAssetResolver(bundle);
      scene = bundle.manifest;
      resolveAssetPath = (path) => this.bundleResolver!.resolve(path);
    } else {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed?.format === "whmap" && parsed.scene) {
        parsed.scene.metadata = {
          exportedAt: new Date().toISOString(),
          format: "web-hammer-engine",
          version: 6
        };
        scene = parseWebHammerEngineScene(JSON.stringify(parsed.scene));
      } else {
        scene = parseWebHammerEngineScene(text);
      }
    }

    if (version !== this.loadVersion) return;
    await this.buildScene(scene, resolveAssetPath, version);
  }

  private async buildScene(
    scene: WebHammerEngineScene,
    resolveAssetPath: (path: string) => Promise<string> | string,
    version: number
  ) {
    // Clear
    while (this.worldRoot.children.length) this.worldRoot.remove(this.worldRoot.children[0]);
    clearWebHammerWorldSettings(this.scene);

    // World settings (fog, skybox, etc.)
    const settings = normalizeSceneSettings(scene.settings);
    this.scene.background = new Color(settings.world.fogColor);
    await applyWebHammerWorldSettings(this.scene, { settings }, {
      resolveAssetUrl: ({ path }) => resolveAssetPath(path)
    });
    if (version !== this.loadVersion) return;

    // Ambient light
    if (settings.world.ambientIntensity > 0) {
      this.worldRoot.add(new AmbientLight(settings.world.ambientColor, settings.world.ambientIntensity));
    }

    // Create objects via the adapter
    const sceneGraph = resolveSceneGraph(scene.nodes, scene.entities);
    const factory = createWebHammerSceneObjectFactory(scene, {
      resolveAssetUrl: ({ path }) => resolveAssetPath(path)
    });

    for (const node of scene.nodes) {
      if (node.kind === "group" || node.kind === "instancing") continue;
      const object = await factory.createNodeObject(node, {
        transform: sceneGraph.nodeWorldTransforms.get(node.id) ?? node.transform
      });
      if (version !== this.loadVersion) return;
      this.worldRoot.add(object);
    }

    // Instancing
    const instancing = await factory.createInstancingObjects();
    if (version !== this.loadVersion) return;
    instancing.forEach((obj) => this.worldRoot.add(obj));

    // Auto-fit camera
    this.fitCamera();
  }

  private fitCamera() {
    const bounds = new Box3().setFromObject(this.worldRoot);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const maxExtent = Math.max(size.x, size.y, size.z, 2);
    const distance = maxExtent * 1.6;
    this.camera.position.set(center.x + distance, center.y + distance * 0.7, center.z + distance);
    this.controls.target.copy(center);
    this.camera.far = Math.max(2000, distance * 12);
    this.camera.updateProjectionMatrix();
  }

  private resize() {
    const parent = this.renderer.domElement.parentElement;
    if (!parent) return;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
  }

  private readonly tick = () => {
    this.frameHandle = requestAnimationFrame(this.tick);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
