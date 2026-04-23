import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export type ConfigureGLTFLoaderOptions = {
  /**
   * Base path for static assets (Vite: `import.meta.env.BASE_URL`).
   * Defaults to `/` so Draco resolves to `/draco/`.
   */
  publicBaseUrl?: string;
};

const sharedLoaders = new Map<string, GLTFLoader>();

export function resolveDracoDecoderPath(publicBaseUrl = "/"): string {
  const base = publicBaseUrl.endsWith("/") ? publicBaseUrl : `${publicBaseUrl}/`;
  return `${base}draco/`;
}

/**
 * GLTFLoader with Draco mesh compression and Meshopt vertex compression support
 * (same stack as the orchestrator game launcher).
 */
export function createConfiguredGLTFLoader(options: ConfigureGLTFLoaderOptions = {}): GLTFLoader {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(resolveDracoDecoderPath(options.publicBaseUrl ?? "/"));
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.setDRACOLoader(dracoLoader);
  return loader;
}

/**
 * One configured loader per `publicBaseUrl` so Draco WASM is not re-initialized per load.
 */
export function getSharedGLTFLoader(options: ConfigureGLTFLoaderOptions = {}): GLTFLoader {
  const key = options.publicBaseUrl ?? "/";
  let loader = sharedLoaders.get(key);
  if (!loader) {
    loader = createConfiguredGLTFLoader({ publicBaseUrl: key });
    sharedLoaders.set(key, loader);
  }
  return loader;
}
