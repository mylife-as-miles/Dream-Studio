import { createRigDefinition, type AnimationClipAsset, type RigDefinition } from "@blud/anim-core"
import {
  createAnimationArtifact,
  createAnimationBundle,
  serializeAnimationArtifact,
  serializeAnimationBundle,
  serializeClipDataBinary,
} from "@blud/anim-exporter"
import type { CompiledAnimatorGraph } from "@blud/anim-schema"
import { strToU8, zipSync } from "fflate"
import type { AnimationClip, Model, Quat, Vec3 } from "reze-engine"

const EXPORT_CLIP_NAME = "__reze_runtime_export__"
const RUNTIME_FPS = 30
const TRANSLATION_EPSILON = 1e-4
const ROTATION_EPSILON = 1e-4
const MORPH_EPSILON = 1e-4

type RuntimeAccess = {
  runtimeSkeleton: {
    localRotations: Quat[]
    localTranslations: Vec3[]
  }
}

type RuntimeBundleFiles = {
  files: Map<string, Uint8Array>
  folderName: string
  warnings: string[]
}

export type StudioRuntimeBundleZipResult = {
  bytes: Uint8Array
  fileName: string
  folderName: string
  warnings: string[]
}

export type StudioRuntimeBundleSyncResult = {
  files: Array<{
    bytes: number[]
    mimeType: string
    path: string
  }>
  folderName: string
  warnings: string[]
}

function sanitizeBundleName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "reze-animation"
}

function createRuntimeBundleIndexModule(input: { folderName: string; title: string }) {
  return [
    "import {",
    "  createColocatedRuntimeAnimationSource,",
    "  defineGameAnimationBundle",
    '} from "../../game/runtime-animation-sources";',
    "",
    'const assetUrlLoaders = import.meta.glob("./assets/**/*", {',
    '  import: "default",',
    '  query: "?url"',
    "}) as Record<string, () => Promise<string>>;",
    "",
    "export const animationBundle = defineGameAnimationBundle({",
    `  id: ${JSON.stringify(input.folderName)},`,
    "  source: createColocatedRuntimeAnimationSource({",
    '    artifactLoader: () => import("./graph.animation.json?raw").then((module) => module.default),',
    "    assetUrlLoaders,",
    '    manifestLoader: () => import("./animation.bundle.json").then((module) => module.default),',
    "  }),",
    `  title: ${JSON.stringify(input.title)},`,
    "});",
    "",
  ].join("\n")
}

function getMimeType(path: string): string {
  if (path.endsWith(".ts")) return "text/plain"
  if (path.endsWith(".json")) return "application/json"
  return "application/octet-stream"
}

function rotateVec3ByQuat(vector: Vec3, rotation: Quat) {
  const vx = vector.x
  const vy = vector.y
  const vz = vector.z
  const qx = rotation.x
  const qy = rotation.y
  const qz = rotation.z
  const qw = rotation.w

  const tx = 2 * (qy * vz - qz * vy)
  const ty = 2 * (qz * vx - qx * vz)
  const tz = 2 * (qx * vy - qy * vx)

  return {
    x: vx + qw * tx + (qy * tz - qz * ty),
    y: vy + qw * ty + (qz * tx - qx * tz),
    z: vz + qw * tz + (qx * ty - qy * tx),
  }
}

function createRigFromRezeModel(model: Model): RigDefinition {
  const skeleton = model.getSkeleton()
  const parentIndices = skeleton.bones.map((bone) => bone.parentIndex)
  const rootBoneIndex = Math.max(0, parentIndices.findIndex((parentIndex) => parentIndex < 0))
  const bindTranslations: number[] = []
  const bindRotations: number[] = []
  const bindScales: number[] = []

  skeleton.bones.forEach((bone) => {
    bindTranslations.push(
      bone.bindTranslation[0] ?? 0,
      bone.bindTranslation[1] ?? 0,
      bone.bindTranslation[2] ?? 0,
    )
    bindRotations.push(0, 0, 0, 1)
    bindScales.push(1, 1, 1)
  })

  return createRigDefinition({
    boneNames: skeleton.bones.map((bone) => bone.name),
    parentIndices,
    rootBoneIndex,
    bindTranslations,
    bindRotations,
    bindScales,
  })
}

function isTripletDifferentFromBind(
  values: number[],
  bindX: number,
  bindY: number,
  bindZ: number,
  epsilon = TRANSLATION_EPSILON,
) {
  for (let index = 0; index < values.length; index += 3) {
    if (
      Math.abs((values[index] ?? 0) - bindX) > epsilon ||
      Math.abs((values[index + 1] ?? 0) - bindY) > epsilon ||
      Math.abs((values[index + 2] ?? 0) - bindZ) > epsilon
    ) {
      return true
    }
  }

  return false
}

function areTripletsUniform(values: number[], epsilon = TRANSLATION_EPSILON) {
  if (values.length <= 3) return true

  const baseX = values[0] ?? 0
  const baseY = values[1] ?? 0
  const baseZ = values[2] ?? 0

  for (let index = 3; index < values.length; index += 3) {
    if (
      Math.abs((values[index] ?? 0) - baseX) > epsilon ||
      Math.abs((values[index + 1] ?? 0) - baseY) > epsilon ||
      Math.abs((values[index + 2] ?? 0) - baseZ) > epsilon
    ) {
      return false
    }
  }

  return true
}

function isQuaternionDifferentFromIdentity(values: number[], epsilon = ROTATION_EPSILON) {
  for (let index = 0; index < values.length; index += 4) {
    const dot = Math.abs(
      (values[index] ?? 0) * 0 +
      (values[index + 1] ?? 0) * 0 +
      (values[index + 2] ?? 0) * 0 +
      (values[index + 3] ?? 1),
    )
    if (1 - dot > epsilon) {
      return true
    }
  }

  return false
}

function isScalarDifferentFromValue(values: number[], bindValue: number, epsilon = MORPH_EPSILON) {
  for (let index = 0; index < values.length; index += 1) {
    if (Math.abs((values[index] ?? 0) - bindValue) > epsilon) {
      return true
    }
  }

  return false
}

function areQuaternionsUniform(values: number[], epsilon = ROTATION_EPSILON) {
  if (values.length <= 4) return true

  const baseX = values[0] ?? 0
  const baseY = values[1] ?? 0
  const baseZ = values[2] ?? 0
  const baseW = values[3] ?? 1

  for (let index = 4; index < values.length; index += 4) {
    const dot = Math.abs(
      baseX * (values[index] ?? 0) +
      baseY * (values[index + 1] ?? 0) +
      baseZ * (values[index + 2] ?? 0) +
      baseW * (values[index + 3] ?? 1),
    )
    if (1 - dot > epsilon) {
      return false
    }
  }

  return true
}

function areScalarsUniform(values: number[], epsilon = MORPH_EPSILON) {
  if (values.length <= 1) return true

  const base = values[0] ?? 0
  for (let index = 1; index < values.length; index += 1) {
    if (Math.abs((values[index] ?? 0) - base) > epsilon) {
      return false
    }
  }

  return true
}

function getBoneDepth(rig: RigDefinition, boneIndex: number): number {
  let depth = 0
  let current = boneIndex

  while (current >= 0) {
    current = rig.parentIndices[current] ?? -1
    if (current >= 0) depth += 1
  }

  return depth
}

function scoreRootMotionBoneName(name: string): number {
  const normalized = name.trim().toLowerCase()

  if (normalized === "センター" || normalized.includes("center")) return 500
  if (normalized === "グルーブ" || normalized.includes("groove")) return 420
  if (normalized.includes("hips")) return 380
  if (normalized.includes("pelvis")) return 340
  if (normalized === "root" || normalized.includes("root")) return 260
  if (normalized === "下半身") return 200
  return 0
}

function estimateTranslationTravel(values: Float32Array | undefined): number {
  if (!values || values.length < 6) return 0

  let maxDistance = 0
  const startX = values[0] ?? 0
  const startY = values[1] ?? 0
  const startZ = values[2] ?? 0

  for (let index = 3; index < values.length; index += 3) {
    const dx = (values[index] ?? 0) - startX
    const dy = (values[index + 1] ?? 0) - startY
    const dz = (values[index + 2] ?? 0) - startZ
    maxDistance = Math.max(maxDistance, Math.hypot(dx, dy, dz))
  }

  return maxDistance
}

function inferRootBoneIndex(rig: RigDefinition, clip: AnimationClipAsset) {
  const candidates = clip.tracks
    .filter((track) => track.translationTimes && track.translationValues)
    .map((track) => ({
      boneIndex: track.boneIndex,
      depth: getBoneDepth(rig, track.boneIndex),
      nameScore: scoreRootMotionBoneName(rig.boneNames[track.boneIndex] ?? ""),
      travel: estimateTranslationTravel(track.translationValues),
    }))
    .sort((left, right) => {
      if (left.nameScore !== right.nameScore) return right.nameScore - left.nameScore
      if (left.travel !== right.travel) return right.travel - left.travel
      if (left.depth !== right.depth) return left.depth - right.depth
      return left.boneIndex - right.boneIndex
    })

  return candidates[0]?.boneIndex
}

function createSingleClipGraph(input: {
  clipId: string
  clipName: string
  duration: number
}): CompiledAnimatorGraph {
  return {
    version: 1,
    name: input.clipName,
    parameters: [],
    clipSlots: [
      {
        id: input.clipId,
        name: input.clipName,
        duration: input.duration,
      },
    ],
    masks: [],
    dynamicsProfiles: [],
    graphs: [
      {
        name: "Main",
        rootNodeIndex: 0,
        nodes: [
          {
            type: "clip",
            clipIndex: 0,
            speed: 1,
            loop: true,
            inPlace: false,
          },
        ],
      },
    ],
    layers: [
      {
        name: "Base",
        graphIndex: 0,
        weight: 1,
        blendMode: "override",
        rootMotionMode: "none",
        enabled: true,
      },
    ],
    entryGraphIndex: 0,
  }
}

function bakeRezeClipToRuntimeAsset(model: Model, clip: AnimationClip, rig: RigDefinition, clipName: string): AnimationClipAsset {
  const skeleton = model.getSkeleton()
  const morphing = model.getMorphing()
  const morphWeights = model.getMorphWeights()
  const runtimeSkeleton = (model as unknown as RuntimeAccess).runtimeSkeleton
  const sampleCount = Math.max(1, Math.floor(clip.frameCount) + 1)
  const sampleTimes = Array.from({ length: sampleCount }, (_, frame) => frame / RUNTIME_FPS)
  const translationSamples = Array.from({ length: skeleton.bones.length }, () => [] as number[])
  const rotationSamples = Array.from({ length: skeleton.bones.length }, () => [] as number[])
  const morphSamples = Array.from({ length: morphing.morphs.length }, () => [] as number[])
  const originalProgress = model.getAnimationProgress()
  try {
    model.loadClip(EXPORT_CLIP_NAME, clip)
    model.show(EXPORT_CLIP_NAME)

    for (let frame = 0; frame < sampleCount; frame += 1) {
      const sampleTime = sampleTimes[frame] ?? 0
      model.seek(sampleTime)
      model.update(0, true)

      for (let boneIndex = 0; boneIndex < skeleton.bones.length; boneIndex += 1) {
        const bone = skeleton.bones[boneIndex]
        const rotation = runtimeSkeleton.localRotations[boneIndex]
        const translationDelta = runtimeSkeleton.localTranslations[boneIndex]
        const rotatedDelta = rotateVec3ByQuat(translationDelta, rotation)

        translationSamples[boneIndex]!.push(
          (bone.bindTranslation[0] ?? 0) + rotatedDelta.x,
          (bone.bindTranslation[1] ?? 0) + rotatedDelta.y,
          (bone.bindTranslation[2] ?? 0) + rotatedDelta.z,
        )
        rotationSamples[boneIndex]!.push(
          rotation.x,
          rotation.y,
          rotation.z,
          rotation.w,
        )
      }

      for (let morphIndex = 0; morphIndex < morphing.morphs.length; morphIndex += 1) {
        morphSamples[morphIndex]!.push(morphWeights[morphIndex] ?? 0)
      }
    }
  } finally {
    if (originalProgress.animationName) {
      model.show(originalProgress.animationName)
      model.seek(originalProgress.current)
      model.update(0, true)
      if (originalProgress.playing) model.play()
      if (originalProgress.paused) model.pause()
    }
  }

  const tracks = skeleton.bones.flatMap((bone, boneIndex) => {
    const translationValues = translationSamples[boneIndex] ?? []
    const rotationValues = rotationSamples[boneIndex] ?? []
    const track: AnimationClipAsset["tracks"][number] = { boneIndex }

    if (
      isTripletDifferentFromBind(
        translationValues,
        bone.bindTranslation[0] ?? 0,
        bone.bindTranslation[1] ?? 0,
        bone.bindTranslation[2] ?? 0,
      )
    ) {
      track.translationTimes = areTripletsUniform(translationValues)
        ? Float32Array.from([0])
        : Float32Array.from(sampleTimes)
      track.translationValues = areTripletsUniform(translationValues)
        ? Float32Array.from(translationValues.slice(0, 3))
        : Float32Array.from(translationValues)
    }

    if (isQuaternionDifferentFromIdentity(rotationValues)) {
      track.rotationTimes = areQuaternionsUniform(rotationValues)
        ? Float32Array.from([0])
        : Float32Array.from(sampleTimes)
      track.rotationValues = areQuaternionsUniform(rotationValues)
        ? Float32Array.from(rotationValues.slice(0, 4))
        : Float32Array.from(rotationValues)
    }

    return track.translationTimes || track.rotationTimes ? [track] : []
  })

  const asset: AnimationClipAsset = {
    id: sanitizeBundleName(clipName),
    name: clipName,
    duration: clip.frameCount / RUNTIME_FPS,
    rootBoneIndex: undefined,
    tracks,
    morphTracks: morphing.morphs.flatMap((morph, morphIndex) => {
      const values = morphSamples[morphIndex] ?? []
      if (!isScalarDifferentFromValue(values, 0)) {
        return []
      }

      return [{
        morphName: morph.name,
        times: areScalarsUniform(values) ? Float32Array.from([0]) : Float32Array.from(sampleTimes),
        values: areScalarsUniform(values) ? Float32Array.from([values[0] ?? 0]) : Float32Array.from(values),
      }]
    }),
  }

  return {
    ...asset,
    rootBoneIndex: inferRootBoneIndex(rig, asset),
  }
}

function buildRuntimeBundleFiles(input: {
  clip: AnimationClip
  clipName: string
  model: Model
  sourceName: string
}) : RuntimeBundleFiles {
  const folderName = sanitizeBundleName(input.clipName)
  const rig = createRigFromRezeModel(input.model)
  const clipAsset = bakeRezeClipToRuntimeAsset(input.model, input.clip, rig, input.clipName)
  const compiledGraph = createSingleClipGraph({
    clipId: clipAsset.id,
    clipName: clipAsset.name,
    duration: clipAsset.duration,
  })
  const artifact = createAnimationArtifact({
    graph: compiledGraph,
    rig,
  })
  const manifest = createAnimationBundle({
    name: input.clipName,
    artifactPath: "./graph.animation.json",
    clipDataPath: "./assets/graph.animation.clips.bin",
    clips: [
      {
        id: clipAsset.id,
        name: clipAsset.name,
        duration: clipAsset.duration,
        source: input.sourceName,
      },
    ],
  })
  const warnings: string[] = []

  const files = new Map<string, Uint8Array>()
  files.set("animation.bundle.json", strToU8(serializeAnimationBundle(manifest)))
  files.set("animation.meta.json", strToU8(JSON.stringify({ id: folderName, title: input.clipName }, null, 2)))
  files.set("graph.animation.json", strToU8(serializeAnimationArtifact(artifact)))
  files.set("assets/graph.animation.clips.bin", serializeClipDataBinary([clipAsset]))
  files.set(
    "index.ts",
    strToU8(
      createRuntimeBundleIndexModule({
        folderName,
        title: input.clipName,
      }),
    ),
  )

  return { files, folderName, warnings }
}

export function createStudioRuntimeBundleZip(input: {
  clip: AnimationClip
  clipName: string
  model: Model
  sourceName: string
}): StudioRuntimeBundleZipResult {
  const bundle = buildRuntimeBundleFiles(input)
  const prefixedFiles = Object.fromEntries(
    Array.from(bundle.files.entries()).map(([path, bytes]) => [`animations/${bundle.folderName}/${path}`, bytes]),
  )

  return {
    bytes: zipSync(prefixedFiles, { level: 6 }),
    fileName: `${bundle.folderName}.bludanim.zip`,
    folderName: bundle.folderName,
    warnings: bundle.warnings,
  }
}

export function createStudioRuntimeBundleSyncResult(input: {
  clip: AnimationClip
  clipName: string
  model: Model
  sourceName: string
}): StudioRuntimeBundleSyncResult {
  const bundle = buildRuntimeBundleFiles(input)

  return {
    files: Array.from(bundle.files.entries()).map(([path, bytes]) => ({
      bytes: Array.from(bytes),
      mimeType: getMimeType(path),
      path,
    })),
    folderName: bundle.folderName,
    warnings: bundle.warnings,
  }
}
