import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const CAMERA_RADIUS = 15;
const MIN_POLAR = 0.86;
const MAX_POLAR = 1.32;

/** Load the manifest and pick one random model to display. */
async function pickOneModel(): Promise<string | null> {
  try {
    const res = await fetch("/models/manifest.json");
    if (res.ok) {
      const data = (await res.json()) as { models?: string[] };
      const list = data.models ?? [];
      if (list.length > 0) return list[Math.floor(Math.random() * list.length)];
    }
  } catch { /* ignore */ }

  return null;
}

export function LauncherViewportScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const maybeCanvas = canvasRef.current;
    const maybeParent = maybeCanvas?.parentElement;
    if (!maybeCanvas || !maybeParent) return;

    const canvasElement = maybeCanvas as HTMLCanvasElement;
    const parentElement = maybeParent as HTMLElement;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas: canvasElement,
      powerPreference: "high-performance"
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
    const target = new THREE.Vector3(0, 0, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xc8d0ff, 2.5);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);
    const fillLight = new THREE.DirectionalLight(0x6a5cff, 1.0);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    // Floor & grids
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(58, 58),
      new THREE.MeshBasicMaterial({
        color: 0x070911, opacity: 0.86, side: THREE.DoubleSide, transparent: true
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.025;
    scene.add(floor);

    const grid = new THREE.GridHelper(58, 58, 0x3b3f51, 0x1c202c);
    grid.position.y = 0.01;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const m of gridMaterials) { m.transparent = true; m.opacity = 0.32; m.depthWrite = false; }
    scene.add(grid);

    const nearGrid = new THREE.GridHelper(14, 14, 0x6a5cff, 0x272b3a);
    nearGrid.position.y = 0.018;
    nearGrid.position.z = 4.5;
    const nearGridMats = Array.isArray(nearGrid.material) ? nearGrid.material : [nearGrid.material];
    for (const m of nearGridMats) { m.transparent = true; m.opacity = 0.15; m.depthWrite = false; }
    scene.add(nearGrid);

    const horizon = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 2.5),
      new THREE.MeshBasicMaterial({ color: 0x161927, opacity: 0.16, transparent: true })
    );
    horizon.position.set(0, 0.18, -17);
    scene.add(horizon);

    // --- Single showcase model (loaded lazily after first paint) ---
    let loadedModel: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    const clock = new THREE.Clock();
    let cancelled = false;

    // Defer model loading so the scene renders immediately
    const loadTimeout = window.setTimeout(() => {
      if (cancelled) return;

      void pickOneModel().then(async (modelPath) => {
        if (cancelled || !modelPath) return;

        try {
          const loader = new GLTFLoader();
          const gltf = await loader.loadAsync(modelPath);
          if (cancelled) return;

          const model = gltf.scene;

          // Fit model within a 5-unit bounding box
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = maxDim > 0 ? 5 / maxDim : 1;
          model.scale.setScalar(scale);

          // Place on floor at origin
          box.setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.set(-center.x, -box.min.y, -center.z);

          scene.add(model);
          loadedModel = model;

          if (gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            for (const clip of gltf.animations) {
              mixer.clipAction(clip).play();
            }
          }
        } catch (err) {
          console.warn("[LauncherViewport] Failed to load model:", err);
        }
      });
    }, 500); // 500ms delay so the grid renders first

    // --- Orbit & render loop ---
    const pointer = { active: false, lastX: 0, lastY: 0 };
    const orbit = { polar: 1.08, targetPolar: 1.08, targetTheta: 0, theta: 0 };

    function updateSize() {
      const rect = parentElement.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function placeCamera() {
      orbit.theta = THREE.MathUtils.lerp(orbit.theta, orbit.targetTheta, 0.08);
      orbit.polar = THREE.MathUtils.lerp(orbit.polar, orbit.targetPolar, 0.08);
      camera.position.set(
        Math.sin(orbit.theta) * Math.sin(orbit.polar) * CAMERA_RADIUS,
        Math.cos(orbit.polar) * CAMERA_RADIUS + 1.8,
        Math.cos(orbit.theta) * Math.sin(orbit.polar) * CAMERA_RADIUS
      );
      camera.lookAt(target);
    }

    let frame = 0;
    let animationFrame = 0;
    const render = () => {
      frame += 1;
      const delta = clock.getDelta();
      if (!pointer.active) orbit.targetTheta += 0.00055;
      if (mixer) mixer.update(delta);
      floor.material.opacity = 0.82 + Math.sin(frame * 0.012) * 0.02;
      placeCamera();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };

    function onPointerDown(e: PointerEvent) {
      pointer.active = true; pointer.lastX = e.clientX; pointer.lastY = e.clientY;
      canvasElement.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: PointerEvent) {
      if (!pointer.active) return;
      orbit.targetTheta -= (e.clientX - pointer.lastX) * 0.006;
      orbit.targetPolar = THREE.MathUtils.clamp(orbit.targetPolar + (e.clientY - pointer.lastY) * 0.004, MIN_POLAR, MAX_POLAR);
      pointer.lastX = e.clientX; pointer.lastY = e.clientY;
    }
    function onPointerUp(e: PointerEvent) {
      pointer.active = false;
      if (canvasElement.hasPointerCapture(e.pointerId)) canvasElement.releasePointerCapture(e.pointerId);
    }

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(parentElement);
    canvasElement.addEventListener("pointerdown", onPointerDown);
    canvasElement.addEventListener("pointermove", onPointerMove);
    canvasElement.addEventListener("pointerup", onPointerUp);
    canvasElement.addEventListener("pointercancel", onPointerUp);

    updateSize();
    placeCamera();
    render();

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimeout);
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      canvasElement.removeEventListener("pointerdown", onPointerDown);
      canvasElement.removeEventListener("pointermove", onPointerMove);
      canvasElement.removeEventListener("pointerup", onPointerUp);
      canvasElement.removeEventListener("pointercancel", onPointerUp);

      if (loadedModel) {
        scene.remove(loadedModel);
        loadedModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              for (const mat of child.material) mat.dispose();
            } else {
              child.material.dispose();
            }
          }
        });
      }
      if (mixer) mixer.stopAllAction();

      floor.geometry.dispose(); floor.material.dispose();
      grid.geometry.dispose(); for (const m of gridMaterials) m.dispose();
      nearGrid.geometry.dispose(); for (const m of nearGridMats) m.dispose();
      horizon.geometry.dispose(); horizon.material.dispose();
      ambientLight.dispose(); directionalLight.dispose(); fillLight.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="games-viewport-scene"
      data-testid="launcher-viewport-scene"
    />
  );
}
