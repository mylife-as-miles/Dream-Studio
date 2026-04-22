import { addPoseAdditive, blendPosesMasked, copyPose, createPoseBufferFromRig, createRootMotionDelta } from "@blud/anim-core";
import type { AnimationClipAsset, RigDefinition } from "@blud/anim-core";
import type { CompiledAnimatorGraph } from "@blud/anim-schema";
import { createAnimatorParameterStore } from "../parameters";
import { addScaledRootMotion } from "./helpers";
import { evaluateNode } from "./evaluation";
import { createClipsBySlot, createMasks, ensureScratchMorphState, ensureScratchMotion, ensureScratchPose, releaseScratchMorphState, releaseScratchMotion, releaseScratchPose, resetRootMotion } from "./scratch";
import type { AnimatorInstance, AnimatorUpdateResult, EvaluationContext, LayerRuntimeState, MorphStateBuffer, SecondaryDynamicsChainRuntimeState, StateMachineRuntimeState } from "./types";

export type { AnimatorInstance, AnimatorUpdateResult } from "./types";

function collectMorphNames(clips: AnimationClipAsset[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const clip of clips) {
    for (const track of clip.morphTracks ?? []) {
      if (seen.has(track.morphName)) {
        continue;
      }

      seen.add(track.morphName);
      names.push(track.morphName);
    }
  }

  return names;
}

function createMorphStateBuffer(morphCount: number): MorphStateBuffer {
  return {
    weights: new Float32Array(morphCount),
    touched: new Uint8Array(morphCount)
  };
}

function copyMorphStateToOutput(source: MorphStateBuffer, target: Float32Array): void {
  target.fill(0);

  for (let index = 0; index < target.length; index += 1) {
    if (source.touched[index] !== 0) {
      target[index] = source.weights[index]!;
    }
  }
}

function applyAdditiveMorphLayer(target: Float32Array, source: MorphStateBuffer, weight: number): void {
  for (let index = 0; index < target.length; index += 1) {
    if (source.touched[index] === 0) {
      continue;
    }

    target[index] += source.weights[index]! * weight;
  }
}

function applyOverrideMorphLayer(target: Float32Array, source: MorphStateBuffer, weight: number): void {
  for (let index = 0; index < target.length; index += 1) {
    if (source.touched[index] === 0) {
      continue;
    }

    target[index] += (source.weights[index]! - target[index]!) * weight;
  }
}

export function createAnimatorInstance(input: {
  rig: RigDefinition;
  graph: CompiledAnimatorGraph;
  clips: AnimationClipAsset[];
}): AnimatorInstance {
  const dynamicsProfiles = input.graph.dynamicsProfiles ?? [];
  const parameters = createAnimatorParameterStore(input.graph);
  const clips = createClipsBySlot(input.graph, input.clips);
  const morphNames = collectMorphNames(clips);
  const morphIndexByName = new Map(morphNames.map((name, index) => [name, index]));
  const masks = createMasks(input.graph);
  const layerStates: LayerRuntimeState[] = input.graph.layers.map(() => ({ time: 0 }));
  const machineCount = input.graph.graphs.flatMap((graph) => graph.nodes).reduce((count, node) => {
    if (node.type === "stateMachine") {
      return Math.max(count, node.machineIndex + 1);
    }
    return count;
  }, 0);
  const machineStates: StateMachineRuntimeState[] = Array.from({ length: machineCount }, () => ({
    initialized: false,
    currentStateIndex: 0,
    lastAdvancedUpdateId: -1,
    previousNextStateTime: 0,
    previousStateTime: 0,
    stateTime: 0,
    transition: null
  }));
  const secondaryDynamicsStates: SecondaryDynamicsChainRuntimeState[][] = dynamicsProfiles.map((profile) =>
    profile.chains.map((chain) => ({
      initialized: false,
      currentPositions: new Float32Array(chain.boneIndices.length * 3),
      previousPositions: new Float32Array(chain.boneIndices.length * 3),
      previousRootPosition: new Float32Array(3),
      previousRootRotation: new Float32Array([0, 0, 0, 1])
    }))
  );
  const outputPose = createPoseBufferFromRig(input.rig);
  const outputMorphWeights = new Float32Array(morphNames.length);
  const rootMotionDelta = createRootMotionDelta();

  const context: EvaluationContext = {
    graph: input.graph,
    rig: input.rig,
    clips,
    morphNames,
    morphIndexByName,
    masks,
    parameters,
    layerStates,
    machineStates,
    durationCache: new Map(),
    strideWarpScales: new Map(),
    syncGroups: new Map(),
    activeSyncGroups: new Map(),
    secondaryDynamicsStates,
    updateId: 0,
    morphScratch: Array.from({ length: 32 }, () => createMorphStateBuffer(morphNames.length)),
    morphScratchIndex: 0,
    poseScratch: Array.from({ length: 32 }, () => createPoseBufferFromRig(input.rig)),
    motionScratch: Array.from({ length: 32 }, () => createRootMotionDelta()),
    poseScratchIndex: 0,
    motionScratchIndex: 0
  };

  function update(deltaTime: number): AnimatorUpdateResult {
    context.updateId += 1;
    context.morphScratchIndex = 0;
    context.poseScratchIndex = 0;
    context.motionScratchIndex = 0;
    context.syncGroups.clear();
    context.activeSyncGroups.clear();
    parameters.advance(Math.max(0, deltaTime));
    outputMorphWeights.fill(0);
    resetRootMotion(rootMotionDelta);

    let hasBaseLayer = false;

    input.graph.layers.forEach((layer, layerIndex) => {
      if (!layer.enabled || layer.weight <= 0) {
        return;
      }

      const layerState = context.layerStates[layerIndex]!;
      const previousTime = layerState.time;
      layerState.time += deltaTime;

      const graph = input.graph.graphs[layer.graphIndex]!;
      const layerMorphs = ensureScratchMorphState(context);
      const layerPose = ensureScratchPose(context);
      const layerMotion = ensureScratchMotion(context);
      const fallbackPose = layer.blendMode === "override" && layer.maskIndex !== undefined ? outputPose : undefined;

      evaluateNode(context, graph, layer.graphIndex, graph.rootNodeIndex, layerState.time, previousTime, deltaTime, layerPose, layerMorphs, layerMotion, fallbackPose);

      const mask = layer.maskIndex === undefined ? undefined : context.masks[layer.maskIndex];
      if (!hasBaseLayer) {
        copyPose(layerPose, outputPose);
        copyMorphStateToOutput(layerMorphs, outputMorphWeights);
        hasBaseLayer = true;
      } else if (layer.blendMode === "additive") {
        addPoseAdditive(outputPose, layerPose, input.rig, layer.weight, mask, outputPose);
        applyAdditiveMorphLayer(outputMorphWeights, layerMorphs, layer.weight);
      } else {
        blendPosesMasked(outputPose, layerPose, layer.weight, mask, outputPose);
        applyOverrideMorphLayer(outputMorphWeights, layerMorphs, layer.weight);
      }

      if (layer.rootMotionMode !== "none") {
        addScaledRootMotion(rootMotionDelta, layerMotion, layer.weight);
        if (layer.rootMotionMode === "xz" || layer.rootMotionMode === "xz-yaw") {
          rootMotionDelta.translation[1] = 0;
        }
        if (layer.rootMotionMode === "xz") {
          rootMotionDelta.yaw = 0;
        }
      }

      releaseScratchMotion(context);
      releaseScratchPose(context);
      releaseScratchMorphState(context);
    });

    parameters.resetTriggers();
    return {
      morphNames,
      morphWeights: outputMorphWeights,
      pose: outputPose,
      rootMotion: rootMotionDelta
    };
  }

  return {
    rig: input.rig,
    graph: input.graph,
    clips,
    morphNames,
    outputMorphWeights,
    parameters,
    outputPose,
    rootMotionDelta,
    setFloat(name, value) {
      parameters.setFloat(name, value);
    },
    setInt(name, value) {
      parameters.setInt(name, value);
    },
    setBool(name, value) {
      parameters.setBool(name, value);
    },
    trigger(name) {
      parameters.trigger(name);
    },
    update
  };
}
