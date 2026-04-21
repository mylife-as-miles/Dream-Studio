import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const CAMERA_RADIUS = 15;
const MIN_POLAR = 0.86;
const MAX_POLAR = 1.32;

async function fetchModelPaths(): Promise<string[]> {
  try {
    const response = await fetch("/api/orchestrator/models");
    const data = (await response.json()) as { models?: string[] };
    return data.models ?? [];
  } catch {
    return [];
  }
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

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x06070c, 9, 29);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
    const target = new THREE.Vector3(0, 0, 0);

    // --- Lighting for loaded models ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xc8d0ff, 1.2);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x6a5cff, 0.3);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    // --- Floor & grids ---
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(58, 58),
      new THREE.MeshBasicMaterial({
        color: 0x070911,
        opacity: 0.86,
        side: THREE.DoubleSide,
        transparent: true
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.025;
    scene.add(floor);

    const grid = new THREE.GridHelper(58, 58, 0x3b3f51, 0x1c202c);
    grid.position.y = 0.01;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const material of gridMaterials) {
      material.transparent = true;
      material.opacity = 0.32;
      material.depthWrite = false;
    }
    scene.add(grid);

    const nearGrid = new THREE.GridHelper(14, 14, 0x6a5cff, 0x272b3a);
    nearGrid.position.y = 0.018;
    nearGrid.position.z = 4.5;
    const nearGridMaterials = Array.isArray(nearGrid.material) ? nearGrid.material : [nearGrid.material];
    for (const material of nearGridMaterials) {
      material.transparent = true;
      material.opacity = 0.15;
      material.depthWrite = false;
    }
    scene.add(nearGrid);

    const horizon = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 2.5),
      new THREE.MeshBasicMaterial({
        color: 0x161927,
        opacity: 0.16,
        transparent: true
      })
    );
    horizon.position.set(0, 0.18, -17);
    scene.add(horizon);

    // --- Load models from public/models/ ---
    const loadedModels: THREE.Object3D[] = [];
    const mixers: THREE.AnimationMixer[] = [];
    const clock = new THREE.Clock();
    let cancelled = false;

    void fetchModelPaths().then((paths) => {
      if (cancelled || paths.length === 0) return;

      const loader = new GLTFLoader();
      const spacing = 4;
      const totalWidth = (paths.length - 1) * spacing;
      const startX = -totalWidth / 2;

      paths.forEach((modelPath, index) => {
        loader.load(
          modelPath,
          (gltf) => {
            if (cancelled) return;

            const model = gltf.scene;

            // Normalize model size: fit within a 3-unit bounding box
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = maxDim > 0 ? 3 / maxDim : 1;
            model.scale.setScalar(scale);

            // Recalculate bounds after scaling and place on the floor
            box.setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.x = startX + index * spacing - center.x;
            model.position.y = -box.min.y;
            model.position.z = -center.z;

            scene.add(model);
            loadedModels.push(model);

            // Play animations if the model has any
            if (gltf.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(model);
              for (const clip of gltf.animations) {
                mixer.clipAction(clip).play();
              }
              mixers.push(mixer);
            }
          },
          undefined,
          (error) => {
            console.warn(`Failed to load model ${modelPath}:`, error);
          }
        );
      });
    });

    // --- Orbit & interaction ---
    const pointer = {
      active: false,
      lastX: 0,
      lastY: 0
    };
    const orbit = {
      polar: 1.08,
      targetPolar: 1.08,
      targetTheta: 0,
      theta: 0
    };

    function updateSize() {
      const rect = parentElement.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
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

      if (!pointer.active) {
        orbit.targetTheta += 0.00055;
      }

      // Update animation mixers
      for (const mixer of mixers) {
        mixer.update(delta);
      }

      floor.material.opacity = 0.82 + Math.sin(frame * 0.012) * 0.02;
      placeCamera();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };

    function onPointerDown(event: PointerEvent) {
      pointer.active = true;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      canvasElement.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
      if (!pointer.active) return;

      const deltaX = event.clientX - pointer.lastX;
      const deltaY = event.clientY - pointer.lastY;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;

      orbit.targetTheta -= deltaX * 0.006;
      orbit.targetPolar = THREE.MathUtils.clamp(
        orbit.targetPolar + deltaY * 0.004,
        MIN_POLAR,
        MAX_POLAR
      );
    }

    function onPointerUp(event: PointerEvent) {
      pointer.active = false;
      if (canvasElement.hasPointerCapture(event.pointerId)) {
        canvasElement.releasePointerCapture(event.pointerId);
      }
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
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      canvasElement.removeEventListener("pointerdown", onPointerDown);
      canvasElement.removeEventListener("pointermove", onPointerMove);
      canvasElement.removeEventListener("pointerup", onPointerUp);
      canvasElement.removeEventListener("pointercancel", onPointerUp);

      // Dispose loaded models
      for (const model of loadedModels) {
        scene.remove(model);
        model.traverse((child) => {
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

      // Stop animation mixers
      for (const mixer of mixers) {
        mixer.stopAllAction();
      }

      floor.geometry.dispose();
      floor.material.dispose();
      grid.geometry.dispose();
      for (const material of gridMaterials) {
        material.dispose();
      }
      nearGrid.geometry.dispose();
      for (const material of nearGridMaterials) {
        material.dispose();
      }
      horizon.geometry.dispose();
      horizon.material.dispose();
      ambientLight.dispose();
      directionalLight.dispose();
      fillLight.dispose();
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
