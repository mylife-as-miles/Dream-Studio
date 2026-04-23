import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getSharedGLTFLoader } from "@blud/three-runtime";

export function createConfiguredGLTFLoader(): GLTFLoader {
  return getSharedGLTFLoader({ publicBaseUrl: import.meta.env?.BASE_URL ?? "/" });
}
