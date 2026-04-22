import type { AnimationClipAsset, RigDefinition } from "./types";

function readRigTranslation(rig: RigDefinition, boneIndex: number) {
  const offset = boneIndex * 3;
  return [
    rig.bindTranslations[offset] ?? 0,
    rig.bindTranslations[offset + 1] ?? 0,
    rig.bindTranslations[offset + 2] ?? 0
  ] as const;
}

function readRigRotation(rig: RigDefinition, boneIndex: number) {
  const offset = boneIndex * 4;
  return [
    rig.bindRotations[offset] ?? 0,
    rig.bindRotations[offset + 1] ?? 0,
    rig.bindRotations[offset + 2] ?? 0,
    rig.bindRotations[offset + 3] ?? 1
  ] as const;
}

function readRigScale(rig: RigDefinition, boneIndex: number) {
  const offset = boneIndex * 3;
  return [
    rig.bindScales[offset] ?? 1,
    rig.bindScales[offset + 1] ?? 1,
    rig.bindScales[offset + 2] ?? 1
  ] as const;
}

function normalizeRigBoneName(name: string): string {
  return name.trim().toLowerCase().replace(/_\d+$/, "");
}

function normalizeMorphName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .replace(/ \d+$/, "");
}

function hasNumericBoneSuffix(name: string): boolean {
  return /_\d+$/.test(name.trim());
}

function getRigBoneExternalChildCount(rig: RigDefinition, boneIndex: number): number {
  const familyName = normalizeRigBoneName(rig.boneNames[boneIndex] ?? "");
  let count = 0;

  rig.parentIndices.forEach((parentIndex, childIndex) => {
    if (parentIndex !== boneIndex) {
      return;
    }

    if (normalizeRigBoneName(rig.boneNames[childIndex] ?? "") !== familyName) {
      count += 1;
    }
  });

  return count;
}

function getRigBoneLocalActivity(rig: RigDefinition, boneIndex: number): number {
  const translation = readRigTranslation(rig, boneIndex);
  const rotation = readRigRotation(rig, boneIndex);
  const scale = readRigScale(rig, boneIndex);
  const translationActivity = Math.hypot(translation[0], translation[1], translation[2]);
  const rotationActivity = Math.acos(Math.min(1, Math.abs(rotation[3]))) * 2 + Math.hypot(rotation[0], rotation[1], rotation[2]);
  const scaleActivity = Math.hypot(scale[0] - 1, scale[1] - 1, scale[2] - 1);
  return translationActivity + rotationActivity + scaleActivity;
}

function buildRigBoneLookup(rig: RigDefinition) {
  const exactIndices = new Map<string, number>();
  const familyIndices = new Map<string, number[]>();

  rig.boneNames.forEach((boneName, boneIndex) => {
    exactIndices.set(boneName.trim().toLowerCase(), boneIndex);

    const familyName = normalizeRigBoneName(boneName);
    const family = familyIndices.get(familyName);
    if (family) {
      family.push(boneIndex);
      return;
    }

    familyIndices.set(familyName, [boneIndex]);
  });

  function resolveIndex(requestedBoneName: string): number | undefined {
    const normalizedRequestedName = requestedBoneName.trim().toLowerCase();
    const family = familyIndices.get(normalizeRigBoneName(requestedBoneName)) ?? [];

    if (family.length === 0) {
      return exactIndices.get(normalizedRequestedName);
    }

    if (family.length === 1) {
      return family[0];
    }

    if (hasNumericBoneSuffix(requestedBoneName)) {
      return exactIndices.get(normalizedRequestedName) ?? family[0];
    }

    return [...family].sort((left, right) => {
      const leftExternalChildren = getRigBoneExternalChildCount(rig, left);
      const rightExternalChildren = getRigBoneExternalChildCount(rig, right);
      if (leftExternalChildren !== rightExternalChildren) {
        return rightExternalChildren - leftExternalChildren;
      }

      const leftActivity = getRigBoneLocalActivity(rig, left);
      const rightActivity = getRigBoneLocalActivity(rig, right);
      if (Math.abs(leftActivity - rightActivity) > 1e-5) {
        return rightActivity - leftActivity;
      }

      const leftName = rig.boneNames[left] ?? "";
      const rightName = rig.boneNames[right] ?? "";
      const leftIsUnsuffixed = !hasNumericBoneSuffix(leftName);
      const rightIsUnsuffixed = !hasNumericBoneSuffix(rightName);
      if (leftIsUnsuffixed !== rightIsUnsuffixed) {
        return leftIsUnsuffixed ? -1 : 1;
      }

      return left - right;
    })[0];
  }

  return {
    resolveIndex
  };
}

function computeRigScaleRatio(sourceRig: RigDefinition, targetRig: RigDefinition): number {
  const sourceLookup = buildRigBoneLookup(sourceRig);
  const targetLookup = buildRigBoneLookup(targetRig);
  const ratios: number[] = [];
  const visitedPairs = new Set<string>();

  sourceRig.boneNames.forEach((boneName) => {
    const sourceBoneIndex = sourceLookup.resolveIndex(boneName);
    const targetBoneIndex = targetLookup.resolveIndex(boneName);
    if (targetBoneIndex === undefined || sourceBoneIndex === undefined) {
      return;
    }

    const pairKey = `${sourceBoneIndex}:${targetBoneIndex}`;
    if (visitedPairs.has(pairKey)) {
      return;
    }
    visitedPairs.add(pairKey);

    if ((sourceRig.parentIndices[sourceBoneIndex] ?? -1) < 0 || (targetRig.parentIndices[targetBoneIndex] ?? -1) < 0) {
      return;
    }

    const sourceTranslation = readRigTranslation(sourceRig, sourceBoneIndex);
    const targetTranslation = readRigTranslation(targetRig, targetBoneIndex);
    const sourceLength = Math.hypot(sourceTranslation[0], sourceTranslation[1], sourceTranslation[2]);
    const targetLength = Math.hypot(targetTranslation[0], targetTranslation[1], targetTranslation[2]);
    if (sourceLength > 1e-5 && targetLength > 1e-5) {
      ratios.push(targetLength / sourceLength);
    }
  });

  if (ratios.length === 0) {
    return 1;
  }

  ratios.sort((left, right) => left - right);
  return ratios[Math.floor(ratios.length / 2)] ?? 1;
}

function invertQuaternion(x: number, y: number, z: number, w: number): [number, number, number, number] {
  const lengthSquared = x * x + y * y + z * z + w * w || 1;
  return [-x / lengthSquared, -y / lengthSquared, -z / lengthSquared, w / lengthSquared];
}

function multiplyQuaternion(
  ax: number,
  ay: number,
  az: number,
  aw: number,
  bx: number,
  by: number,
  bz: number,
  bw: number
): [number, number, number, number] {
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
}

function normalizeQuaternion(x: number, y: number, z: number, w: number): [number, number, number, number] {
  const length = Math.hypot(x, y, z, w) || 1;
  return [x / length, y / length, z / length, w / length];
}

function buildMorphNameResolver(targetMorphNames: Iterable<string> | undefined, morphNameMap: Record<string, string> | undefined) {
  const exactNames = new Map<string, string>();
  const normalizedNames = new Map<string, string[]>();

  for (const morphName of targetMorphNames ?? []) {
    exactNames.set(morphName, morphName);
    exactNames.set(morphName.toLowerCase(), morphName);
    const normalized = normalizeMorphName(morphName);
    const existing = normalizedNames.get(normalized);
    if (existing) {
      existing.push(morphName);
    } else {
      normalizedNames.set(normalized, [morphName]);
    }
  }

  return (sourceMorphName: string) => {
    const explicitName = morphNameMap?.[sourceMorphName];
    if (explicitName) {
      return exactNames.get(explicitName) ?? exactNames.get(explicitName.toLowerCase()) ?? explicitName;
    }

    if (!targetMorphNames) {
      return sourceMorphName;
    }

    const exactMatch = exactNames.get(sourceMorphName) ?? exactNames.get(sourceMorphName.toLowerCase());
    if (exactMatch) {
      return exactMatch;
    }

    const normalizedMatches = normalizedNames.get(normalizeMorphName(sourceMorphName));
    if (normalizedMatches?.length === 1) {
      return normalizedMatches[0];
    }

    return undefined;
  };
}

export function retargetClipAssetToRig(
  sourceAsset: AnimationClipAsset,
  sourceRig: RigDefinition,
  targetRig: RigDefinition,
  options?: {
    morphNameMap?: Record<string, string>;
    targetMorphNames?: Iterable<string>;
  }
): AnimationClipAsset {
  const sourceLookup = buildRigBoneLookup(sourceRig);
  const targetLookup = buildRigBoneLookup(targetRig);
  const translationScaleRatio = computeRigScaleRatio(sourceRig, targetRig);
  const resolveMorphName = buildMorphNameResolver(options?.targetMorphNames, options?.morphNameMap);

  const tracks = sourceAsset.tracks.flatMap((track) => {
    const boneName = sourceRig.boneNames[track.boneIndex];
    if (!boneName) {
      return [];
    }

    const sourceReferenceBoneIndex = sourceLookup.resolveIndex(boneName) ?? track.boneIndex;
    const targetBoneIndex = targetLookup.resolveIndex(boneName);
    if (targetBoneIndex === undefined) {
      return [];
    }

    const nextTrack: AnimationClipAsset["tracks"][number] = { boneIndex: targetBoneIndex };

    if (track.translationTimes && track.translationValues) {
      const sourceBindTranslation = readRigTranslation(sourceRig, sourceReferenceBoneIndex);
      const targetBindTranslation = readRigTranslation(targetRig, targetBoneIndex);
      const nextValues = new Float32Array(track.translationValues.length);

      for (let index = 0; index < track.translationValues.length; index += 3) {
        nextValues[index] = targetBindTranslation[0] + (track.translationValues[index]! - sourceBindTranslation[0]) * translationScaleRatio;
        nextValues[index + 1] = targetBindTranslation[1] + (track.translationValues[index + 1]! - sourceBindTranslation[1]) * translationScaleRatio;
        nextValues[index + 2] = targetBindTranslation[2] + (track.translationValues[index + 2]! - sourceBindTranslation[2]) * translationScaleRatio;
      }

      nextTrack.translationTimes = new Float32Array(track.translationTimes);
      nextTrack.translationValues = nextValues;
    }

    if (track.rotationTimes && track.rotationValues) {
      const sourceBindRotation = readRigRotation(sourceRig, sourceReferenceBoneIndex);
      const targetBindRotation = readRigRotation(targetRig, targetBoneIndex);
      const inverseSourceBindRotation = invertQuaternion(...sourceBindRotation);
      const nextValues = new Float32Array(track.rotationValues.length);

      for (let index = 0; index < track.rotationValues.length; index += 4) {
        const sourceRotation: [number, number, number, number] = [
          track.rotationValues[index]!,
          track.rotationValues[index + 1]!,
          track.rotationValues[index + 2]!,
          track.rotationValues[index + 3]!
        ];
        const targetRotation = normalizeQuaternion(
          ...multiplyQuaternion(
            ...multiplyQuaternion(...targetBindRotation, ...inverseSourceBindRotation),
            ...sourceRotation
          )
        );
        nextValues[index] = targetRotation[0];
        nextValues[index + 1] = targetRotation[1];
        nextValues[index + 2] = targetRotation[2];
        nextValues[index + 3] = targetRotation[3];
      }

      nextTrack.rotationTimes = new Float32Array(track.rotationTimes);
      nextTrack.rotationValues = nextValues;
    }

    if (track.scaleTimes && track.scaleValues) {
      const sourceBindScale = readRigScale(sourceRig, sourceReferenceBoneIndex);
      const targetBindScale = readRigScale(targetRig, targetBoneIndex);
      const nextValues = new Float32Array(track.scaleValues.length);

      for (let index = 0; index < track.scaleValues.length; index += 3) {
        nextValues[index] = targetBindScale[0] * (track.scaleValues[index]! / (sourceBindScale[0] || 1));
        nextValues[index + 1] = targetBindScale[1] * (track.scaleValues[index + 1]! / (sourceBindScale[1] || 1));
        nextValues[index + 2] = targetBindScale[2] * (track.scaleValues[index + 2]! / (sourceBindScale[2] || 1));
      }

      nextTrack.scaleTimes = new Float32Array(track.scaleTimes);
      nextTrack.scaleValues = nextValues;
    }

    return [nextTrack];
  });

  const morphTracks = sourceAsset.morphTracks?.flatMap((track) => {
    const targetMorphName = resolveMorphName(track.morphName);
    if (!targetMorphName) {
      return [];
    }

    return [{
      morphName: targetMorphName,
      times: new Float32Array(track.times),
      values: new Float32Array(track.values)
    }];
  });

  const sourceRootBoneName = sourceAsset.rootBoneIndex === undefined ? undefined : sourceRig.boneNames[sourceAsset.rootBoneIndex];
  const targetRootBoneIndex = sourceRootBoneName ? targetLookup.resolveIndex(sourceRootBoneName) : undefined;

  return {
    ...sourceAsset,
    morphTracks,
    rootBoneIndex: targetRootBoneIndex,
    tracks: tracks.sort((left, right) => left.boneIndex - right.boneIndex)
  };
}
