import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getSharedGLTFLoader } from "@blud/three-runtime";

const CAMERA_RADIUS = 15;
const MIN_POLAR = 0.86;
const MAX_POLAR = 1.32;

const gltfLoader = getSharedGLTFLoader({ publicBaseUrl: "/" });

async function fetchModelPaths(): Promise<string[]> {
  try {
    const res = await fetch("/models/manifest.json");
    if (res.ok) {
      const data = (await res.json()) as { models?: string[] };
      return data.models ?? [];
    }
  } catch { /* ignore */ }
  return [];
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
      alpha: true, antialias: true, canvas: canvasElement, powerPreference: "high-performance"
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x06070c, 30, 55);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
    const target = new THREE.Vector3(0, 0, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xc8d0ff, 2.5);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x6a5cff, 1.0);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    // Floor & grids
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(58, 58),
      new THREE.MeshBasicMaterial({ color: 0x070911, opacity: 0.86, side: THREE.DoubleSide, transparent: true })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.025;
    scene.add(floor);

    const grid = new THREE.GridHelper(58, 58, 0x3b3f51, 0x1c202c);
    grid.position.y = 0.01;
    const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const m of gridMats) { m.transparent = true; m.opacity = 0.32; m.depthWrite = false; }
    scene.add(grid);

    const nearGrid = new THREE.GridHelper(14, 14, 0x6a5cff, 0x272b3a);
    nearGrid.position.y = 0.018; nearGrid.position.z = 4.5;
    const nearMats = Array.isArray(nearGrid.material) ? nearGrid.material : [nearGrid.material];
    for (const m of nearMats) { m.transparent = true; m.opacity = 0.15; m.depthWrite = false; }
    scene.add(nearGrid);

    const horizon = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 2.5),
      new THREE.MeshBasicMaterial({ color: 0x161927, opacity: 0.16, transparent: true })
    );
    horizon.position.set(0, 0.18, -17);
    scene.add(horizon);

    // --- Model loading ---
    const loadedModels: THREE.Object3D[] = [];
    const mixers: THREE.AnimationMixer[] = [];
    const clock = new THREE.Clock();
    let cancelled = false;

    const loadTimeout = window.setTimeout(() => {
      if (cancelled) return;
      void fetchModelPaths().then(async (paths) => {
        if (cancelled || paths.length === 0) return;

        const loader = gltfLoader;
        const spacing = 4;
        const totalWidth = (paths.length - 1) * spacing;
        const startX = -totalWidth / 2;

        for (let i = 0; i < paths.length; i++) {
          if (cancelled) return;
          try {
            const gltf = await loader.loadAsync(paths[i]);
            if (cancelled) return;

            const model = gltf.scene;
            const wrapper = new THREE.Group();
            wrapper.add(model);

            const box = new THREE.Box3().setFromObject(wrapper);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = maxDim > 0 ? 4 / maxDim : 1;
            wrapper.scale.setScalar(scale);
            wrapper.position.set(
              startX + i * spacing - center.x * scale,
              -box.min.y * scale,
              -center.z * scale
            );

            scene.add(wrapper);
            loadedModels.push(wrapper);

            if (gltf.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(model);
              for (const clip of gltf.animations) mixer.clipAction(clip).play();
              mixers.push(mixer);
            }
          } catch (err) {
            console.warn(`[LauncherViewport] Failed to load ${paths[i]}:`, err);
          }
        }
      });
    }, 300);

    // --- Orbit & render ---
    const pointer = { active: false, lastX: 0, lastY: 0 };
    const orbit = { polar: 1.08, targetPolar: 1.08, targetTheta: 0, theta: 0 };

    function updateSize() {
      const r = parentElement.getBoundingClientRect();
      const w = Math.max(1, Math.floor(r.width));
      const h = Math.max(1, Math.floor(r.height));
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
    let raf = 0;
    const render = () => {
      frame += 1;
      const delta = clock.getDelta();
      if (!pointer.active) orbit.targetTheta += 0.00055;
      for (const m of mixers) m.update(delta);
      floor.material.opacity = 0.82 + Math.sin(frame * 0.012) * 0.02;
      placeCamera();
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(render);
    };

    const onDown = (e: PointerEvent) => { pointer.active = true; pointer.lastX = e.clientX; pointer.lastY = e.clientY; canvasElement.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => { if (!pointer.active) return; orbit.targetTheta -= (e.clientX - pointer.lastX) * 0.006; orbit.targetPolar = THREE.MathUtils.clamp(orbit.targetPolar + (e.clientY - pointer.lastY) * 0.004, MIN_POLAR, MAX_POLAR); pointer.lastX = e.clientX; pointer.lastY = e.clientY; };
    const onUp = (e: PointerEvent) => { pointer.active = false; if (canvasElement.hasPointerCapture(e.pointerId)) canvasElement.releasePointerCapture(e.pointerId); };

    const ro = new ResizeObserver(updateSize);
    ro.observe(parentElement);
    canvasElement.addEventListener("pointerdown", onDown);
    canvasElement.addEventListener("pointermove", onMove);
    canvasElement.addEventListener("pointerup", onUp);
    canvasElement.addEventListener("pointercancel", onUp);
    updateSize(); placeCamera(); render();

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimeout);
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      canvasElement.removeEventListener("pointerdown", onDown);
      canvasElement.removeEventListener("pointermove", onMove);
      canvasElement.removeEventListener("pointerup", onUp);
      canvasElement.removeEventListener("pointercancel", onUp);
      if (loadedModels.length > 0) {
        for (const model of loadedModels) {
          scene.remove(model);
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              for (const mat of mats) mat.dispose();
            }
          });
        }
      }
      for (const m of mixers) m.stopAllAction();
      floor.geometry.dispose(); floor.material.dispose();
      grid.geometry.dispose(); for (const m of gridMats) m.dispose();
      nearGrid.geometry.dispose(); for (const m of nearMats) m.dispose();
      horizon.geometry.dispose(); horizon.material.dispose();
      ambientLight.dispose(); dirLight.dispose(); fillLight.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas ref={canvasRef} aria-hidden="true" className="games-viewport-scene" data-testid="launcher-viewport-scene" />
  );
}
