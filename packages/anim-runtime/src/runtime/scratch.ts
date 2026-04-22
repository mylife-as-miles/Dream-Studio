import { clamp } from "@blud/anim-utils";
import type { AnimationClipAsset, BoneMask, RootMotionDelta } from "@blud/anim-core";
import type { CompiledAnimatorGraph } from "@blud/anim-schema";
import type { PoseBuffer } from "@blud/anim-core";
import type { EvaluationContext, MorphStateBuffer } from "./types";

export function createMasks(graph: CompiledAnimatorGraph): BoneMask[] {
  return graph.masks.map((mask) => ({ weights: Float32Array.from(mask.weights) }));
}

export function createClipsBySlot(graph: CompiledAnimatorGraph, clips: AnimationClipAsset[]): AnimationClipAsset[] {
  const clipMap = new Map(clips.map((clip) => [clip.id, clip]));

  return graph.clipSlots.map((slot) => {
    const clip = clipMap.get(slot.id);
    if (!clip) {
      throw new Error(`Missing clip asset for slot "${slot.id}".`);
    }
    return clip;
  });
}

export function ensureScratchPose(context: EvaluationContext): PoseBuffer {
  const pose = context.poseScratch[context.poseScratchIndex];
  if (!pose) {
    throw new Error("Animation runtime pose scratch exhausted.");
  }

  context.poseScratchIndex += 1;
  return pose;
}

export function releaseScratchPose(context: EvaluationContext): void {
  context.poseScratchIndex -= 1;
}

export function ensureScratchMotion(context: EvaluationContext): RootMotionDelta {
  const delta = context.motionScratch[context.motionScratchIndex];
  if (!delta) {
    throw new Error("Animation runtime root motion scratch exhausted.");
  }

  context.motionScratchIndex += 1;
  return delta;
}

export function releaseScratchMotion(context: EvaluationContext): void {
  context.motionScratchIndex -= 1;
}

export function ensureScratchMorphState(context: EvaluationContext): MorphStateBuffer {
  const morphState = context.morphScratch[context.morphScratchIndex];
  if (!morphState) {
    throw new Error("Animation runtime morph scratch exhausted.");
  }

  context.morphScratchIndex += 1;
  return morphState;
}

export function releaseScratchMorphState(context: EvaluationContext): void {
  context.morphScratchIndex -= 1;
}

export function resetRootMotion(out: RootMotionDelta): RootMotionDelta {
  out.translation[0] = 0;
  out.translation[1] = 0;
  out.translation[2] = 0;
  out.yaw = 0;
  return out;
}

export function copyRootMotion(source: RootMotionDelta, out: RootMotionDelta): RootMotionDelta {
  out.translation[0] = source.translation[0];
  out.translation[1] = source.translation[1];
  out.translation[2] = source.translation[2];
  out.yaw = source.yaw;
  return out;
}

export function resetMorphState(out: MorphStateBuffer): MorphStateBuffer {
  out.weights.fill(0);
  out.touched.fill(0);
  return out;
}

export function copyMorphState(source: MorphStateBuffer, out: MorphStateBuffer): MorphStateBuffer {
  out.weights.set(source.weights);
  out.touched.set(source.touched);
  return out;
}

export function blendMorphStates(a: MorphStateBuffer, b: MorphStateBuffer, weight: number, out: MorphStateBuffer): MorphStateBuffer {
  const t = clamp(weight, 0, 1);

  for (let index = 0; index < out.weights.length; index += 1) {
    const aTouched = a.touched[index] !== 0;
    const bTouched = b.touched[index] !== 0;
    const touched = aTouched || bTouched;
    out.touched[index] = touched ? 1 : 0;
    if (!touched) {
      out.weights[index] = 0;
      continue;
    }

    const aValue = aTouched ? a.weights[index]! : 0;
    const bValue = bTouched ? b.weights[index]! : 0;
    out.weights[index] = aValue + (bValue - aValue) * t;
  }

  return out;
}
