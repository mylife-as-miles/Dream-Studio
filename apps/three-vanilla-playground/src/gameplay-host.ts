import { Euler, Quaternion, type Object3D } from "three";
import type { GameplayRuntimeHost } from "@blud/gameplay-runtime";
import type { Transform } from "@blud/shared";
import type { CustomScriptHostServices } from "@blud/runtime-scripting";

type KinematicPhysicsBody = {
  setNextKinematicRotation: (rotation: QuaternionLike) => void;
  setNextKinematicTranslation: (translation: VectorLike) => void;
};

type QuaternionLike = {
  w: number;
  x: number;
  y: number;
  z: number;
};

type VectorLike = {
  x: number;
  y: number;
  z: number;
};

export type PlaybackGameplayHost = {
  bindPhysicsWorld: (world: unknown | null, rapier?: unknown | null) => void;
  bindNodePhysicsBody: (nodeId: string, body: KinematicPhysicsBody | null) => void;
  bindNodeObject: (nodeId: string, object: Object3D | null) => void;
  createCustomScriptServices: (options?: {
    resolveAssetPath?: (path: string) => Promise<string> | string;
  }) => Omit<
    CustomScriptHostServices,
    "entities" | "getLocalTransform" | "getWorldTransform" | "nodes" | "setLocalTransform" | "setWorldTransform"
  >;
  host: GameplayRuntimeHost;
  reset: () => void;
};

export function createPlaybackGameplayHost(): PlaybackGameplayHost {
  const physicsBodiesByNodeId = new Map<string, KinematicPhysicsBody | null>();
  const objectsByNodeId = new Map<string, Object3D | null>();
  const pendingTransforms = new Map<string, Transform>();
  const pressedKeys = new Set<string>();
  let physicsWorld: unknown | null = null;
  let rapierApi: unknown | null = null;

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", (event) => {
      pressedKeys.add(event.code);
    });
    window.addEventListener("keyup", (event) => {
      pressedKeys.delete(event.code);
    });
    window.addEventListener("blur", () => {
      pressedKeys.clear();
    });
  }

  return {
    bindPhysicsWorld(world, rapier) {
      physicsWorld = world;
      rapierApi = rapier ?? null;
    },
    bindNodePhysicsBody(nodeId, body) {
      if (body) {
        physicsBodiesByNodeId.set(nodeId, body);
        const pendingTransform = pendingTransforms.get(nodeId);

        if (pendingTransform) {
          applyBodyTransform(body, pendingTransform);
        }

        return;
      }

      physicsBodiesByNodeId.delete(nodeId);
    },
    bindNodeObject(nodeId, object) {
      if (object) {
        objectsByNodeId.set(nodeId, object);
        const pendingTransform = pendingTransforms.get(nodeId);

        if (pendingTransform) {
          applyTransform(object, pendingTransform);
        }

        return;
      }

      objectsByNodeId.delete(nodeId);
    },
    createCustomScriptServices(options) {
      return {
        assets: options?.resolveAssetPath
          ? {
              resolve: (path) => options.resolveAssetPath!(path)
            }
          : undefined,
        input: {
          isKeyDown: (key) => pressedKeys.has(key)
        },
        log: (level, message, data) => {
          const logger =
            level === "error"
              ? console.error
              : level === "warn"
                ? console.warn
                : level === "debug"
                  ? console.debug
                  : console.info;
          logger("[custom_script]", message, data);
        },
        physics: {
          rapier: rapierApi ?? undefined,
          world: physicsWorld ?? undefined
        }
      };
    },
    host: {
      applyNodeWorldTransform(nodeId, transform) {
        const object = objectsByNodeId.get(nodeId);
        const body = physicsBodiesByNodeId.get(nodeId);

        if (!object && !body) {
          pendingTransforms.set(nodeId, structuredClone(transform));
          return;
        }

        pendingTransforms.set(nodeId, structuredClone(transform));

        if (object) {
          applyTransform(object, transform);
        }

        if (body) {
          applyBodyTransform(body, transform);
        }
      }
    },
    reset() {
      pendingTransforms.clear();
      physicsBodiesByNodeId.clear();
      objectsByNodeId.clear();
      physicsWorld = null;
      rapierApi = null;
    }
  };
}

function applyTransform(object: Object3D, transform: Transform) {
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  object.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
  object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
  object.updateMatrixWorld();
}

function applyBodyTransform(body: KinematicPhysicsBody, transform: Transform) {
  body.setNextKinematicTranslation(transform.position);
  body.setNextKinematicRotation(
    new Quaternion().setFromEuler(new Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z))
  );
}
