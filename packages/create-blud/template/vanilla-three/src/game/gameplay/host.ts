import { type GameplayPhysicsMotorResult, type GameplayRuntimeHost } from "@blud/gameplay-runtime";
import {
  MotionType,
  rigidBody,
  type CrashcatPhysicsWorld,
  type CrashcatRigidBody
} from "@blud/runtime-physics-crashcat";
import type { Transform } from "@blud/shared";
import type { ThreeRuntimeSceneInstance } from "@blud/three-runtime";
import { Euler, Matrix4, Quaternion, Vector3, type Object3D } from "three";
import type { RuntimePhysicsSession } from "../physics/session";

type StarterGameplayHostOptions = {
  physicsWorld: CrashcatPhysicsWorld;
  runtimePhysics: Pick<RuntimePhysicsSession, "getBody">;
  runtimeScene: Pick<ThreeRuntimeSceneInstance, "nodesById">;
};


/**
 * Implements GameplayRuntimeHost: the bridge that lets gameplay systems move
 * scene nodes and physics bodies by calling applyNodeWorldTransform().
 */
export function createStarterGameplayHost(options: StarterGameplayHostOptions): GameplayRuntimeHost {
  return {
    applyNodeWorldTransform(nodeId, transform) {
      const object = options.runtimeScene.nodesById.get(nodeId);
      const body = options.runtimePhysics.getBody(nodeId);

      if (object) applyObjectWorldTransform(object, transform);
      if (body) applyBodyTransform(options.physicsWorld, body, transform);
    },

    driveOpenablePhysicsMotor(nodeId, _deltaSeconds, params) {
      return driveDynamicDoorMotorY(options.physicsWorld, options.runtimePhysics.getBody(nodeId), params);
    }
  };
}

const scratchMotorEuler = new Euler();
const scratchMotorQuat = new Quaternion();

function shortestAngleRad(target: number, current: number): number {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function worldYawFromBodyQuaternion(q: readonly [number, number, number, number]): number {
  scratchMotorQuat.set(q[0], q[1], q[2], q[3]);
  scratchMotorEuler.setFromQuaternion(scratchMotorQuat, "YXZ");
  return scratchMotorEuler.y;
}

function driveDynamicDoorMotorY(
  world: CrashcatPhysicsWorld,
  body: CrashcatRigidBody | undefined,
  params: {
    damping: number;
    maxAngularSpeed: number;
    stiffness: number;
    targetWorldYaw: number;
  }
): GameplayPhysicsMotorResult {
  if (!body || body.motionType !== MotionType.DYNAMIC) {
    return { angularVelocity: 0, error: 0, settled: true };
  }

  const yaw = worldYawFromBodyQuaternion(body.quaternion);
  const err = shortestAngleRad(params.targetWorldYaw, yaw);
  const omegaY = body.motionProperties.angularVelocity[1] ?? 0;
  const nextOmega = Math.max(
    -params.maxAngularSpeed,
    Math.min(params.maxAngularSpeed, params.stiffness * err - params.damping * omegaY)
  );

  rigidBody.setLinearVelocity(world, body, [0, 0, 0]);
  rigidBody.setAngularVelocity(world, body, [0, nextOmega, 0]);

  const settled = Math.abs(err) < 0.045 && Math.abs(omegaY) < 0.09;
  return { angularVelocity: omegaY, error: err, settled };
}

// ------------------------------------------------------------------
// Transform helpers — module-level scratch objects avoid heap allocation
// in the fixed-rate physics update path.

const scratchEuler = new Euler();
const scratchLocalMatrix = new Matrix4();
const scratchWorldMatrix = new Matrix4();
const scratchWorldPosition = new Vector3();
const scratchWorldQuaternion = new Quaternion();
const scratchWorldScale = new Vector3();
const scratchBodyEuler = new Euler();
const scratchBodyQuaternion = new Quaternion();

function applyObjectWorldTransform(object: Object3D, transform: Transform) {
  scratchWorldQuaternion.setFromEuler(
    scratchEuler.set(transform.rotation.x, transform.rotation.y, transform.rotation.z)
  );
  scratchWorldMatrix.compose(
    scratchWorldPosition.set(transform.position.x, transform.position.y, transform.position.z),
    scratchWorldQuaternion,
    scratchWorldScale.set(transform.scale.x, transform.scale.y, transform.scale.z)
  );

  if (object.parent) {
    object.parent.updateMatrixWorld(true);
    scratchLocalMatrix.copy(object.parent.matrixWorld).invert().multiply(scratchWorldMatrix);
    scratchLocalMatrix.decompose(object.position, object.quaternion, object.scale);
  } else {
    scratchWorldMatrix.decompose(object.position, object.quaternion, object.scale);
  }

  object.updateMatrixWorld(true);
}

function applyBodyTransform(world: CrashcatPhysicsWorld, body: CrashcatRigidBody, transform: Transform) {
  if (body.motionType !== MotionType.KINEMATIC) return;

  scratchBodyQuaternion.setFromEuler(
    scratchBodyEuler.set(transform.rotation.x, transform.rotation.y, transform.rotation.z)
  );
  rigidBody.setTransform(
    world,
    body,
    [transform.position.x, transform.position.y, transform.position.z],
    [scratchBodyQuaternion.x, scratchBodyQuaternion.y, scratchBodyQuaternion.z, scratchBodyQuaternion.w],
    false
  );
}
