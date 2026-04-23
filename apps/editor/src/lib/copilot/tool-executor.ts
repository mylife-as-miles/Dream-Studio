import type { EditorCore } from "@blud/editor-core";
import {
  buildQuarterPipe,
  buildHalfPipe,
  buildBank,
  buildSpine,
  buildBowl,
  buildFunBox,
  buildLedge,
  buildRail,
  buildStairSet,
  buildKicker,
  buildManualPad,
  buildPyramid,
  buildHip,
  buildHubbaLedge,
  skateparkMaterials
} from "@blud/skatepark";
import {
  buildWall,
  buildSlab,
  buildCeiling,
  buildRoof,
  buildItem,
  architectureMaterials
} from "@blud/architecture";
import {
  createAssignMaterialCommand,
  createAssignMaterialToBrushesCommand,
  createDeleteSelectionCommand,
  createDuplicateNodesCommand,
  createExtrudeBrushNodesCommand,
  createGroupSelectionCommand,
  createMeshInflateCommand,
  createMirrorNodesCommand,
  createOffsetBrushFaceCommand,
  createPlaceBlockoutPlatformCommand,
  createPlaceBlockoutRoomCommand,
  createPlaceBlockoutStairCommand,
  createPlaceEntityCommand,
  createPlaceLightNodeCommand,
  createPlaceMeshNodeCommand,
  createPlacePrimitiveNodeCommand,
  createReplaceNodesCommand,
  createSetEntityCommand,
  createSetMeshDataCommand,
  createSetNodeCommand,
  createSetNodeTransformCommand,
  createSetSceneSettingsCommand,
  createSetUvScaleCommand,
  createSplitBrushNodeAtCoordinateCommand,
  createSplitBrushNodesCommand,
  createTranslateNodesCommand,
  createUpsertMaterialCommand
} from "@blud/editor-core";
import {
  applyEditableMeshModeling,
  arcEditableMeshEdges,
  bevelEditableMeshEdges,
  bridgeEditableMeshEdges,
  captureEditableMeshModelingBase,
  computePolygonNormal,
  convertBrushToEditableMesh,
  createAxisAlignedBrushFromBounds,
  cutEditableMeshBetweenEdges,
  cutEditableMeshFace,
  deleteEditableMeshFaces,
  extrudeEditableMeshEdge,
  extrudeEditableMeshFaces,
  fillEditableMeshFaceFromVertices,
  getFaceVertices,
  initializeEditableMeshModeling,
  insetEditableMeshFaces,
  invertEditableMeshNormals,
  mergeEditableMeshFaces,
  mergeEditableMeshVertices,
  mirrorEditableMesh,
  pokeEditableMeshFaces,
  quadrangulateEditableMeshFaces,
  markEditableMeshUvSeams,
  normalizeEditableMeshTexelDensity,
  packEditableMeshUvs,
  paintEditableMeshFacesMaterial,
  paintEditableMeshTextureBlend,
  paintEditableMeshVertexColors,
  projectEditableMeshUvs,
  scaleEditableMeshVertices,
  solidifyEditableMesh,
  smartUnwrapEditableMesh,
  translateEditableMeshVertices,
  subdivideEditableMeshFace,
  triangulateEditableMeshFaces,
  updateEditableMeshModeling,
  upsertEditableMeshBlendLayer,
  weldEditableMeshVerticesByDistance,
  weldEditableMeshVerticesToTarget,
  createEditableMeshFromPolygons
} from "@blud/geometry-kernel";
import { isBrushNode, isMeshNode, makeTransform, resolveSceneGraph, vec2, vec3 } from "@blud/shared";
import type {
  EditableMesh,
  ColorRGBA,
  GameplayObject,
  GameplayValue,
  Material,
  MeshBakeMapKind,
  MeshLodProfile,
  MeshModelingModifier,
  MeshPolyGroup,
  MeshSmoothingGroup,
  SceneHook,
  ScenePathDefinition,
  SceneSettings,
  Vec3,
  SkateparkElementType
} from "@blud/shared";
import {
  createDefaultEntity,
  createDefaultLightData,
  createLightNodeLabel,
  createPrimitiveNodeData,
  createPrimitiveNodeLabel
} from "@/lib/authoring";
import { createSceneHook, HOOK_DEFINITION_MAP, HOOK_DEFINITIONS, resolveGameplayEvents, setGameplayValue } from "@/lib/gameplay";
import type { CopilotToolCall, CopilotToolResult } from "./types";

type Args = Record<string, unknown>;

export type CopilotToolExecutionContext = {
  requestScenePush?: (options: {
    forceSwitch?: boolean;
    gameId?: string;
    projectName?: string;
    projectSlug?: string;
  }) => void;
  onGeneratedGame?: (title: string, html: string) => void;
};

function num(args: Args, key: string, fallback = 0): number {
  const v = args[key];
  return typeof v === "number" ? v : fallback;
}

function str(args: Args, key: string, fallback = ""): string {
  const v = args[key];
  return typeof v === "string" ? v : fallback;
}

function optionalStr(args: Args, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" ? v : undefined;
}

function optionalNum(args: Args, key: string): number | undefined {
  const v = args[key];
  return typeof v === "number" ? v : undefined;
}

function strArray(args: Args, key: string): string[] {
  const v = args[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function bool(args: Args, key: string): boolean | undefined {
  const v = args[key];
  return typeof v === "boolean" ? v : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordArray(args: Args, key: string): Record<string, unknown>[] {
  const value = args[key];
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => isRecord(entry)) : [];
}

const MODELING_GROUP_COLORS = ["#f59e0b", "#10b981", "#38bdf8", "#f472b6", "#a78bfa", "#fb7185"];
const BAKE_MAP_KINDS: MeshBakeMapKind[] = ["normals", "ao", "curvature", "id-mask", "vertex-colors"];

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function modifierTypeFromArgs(args: Args): MeshModelingModifier["type"] {
  const type = str(args, "type", "solidify");
  return ["boolean", "mirror", "solidify", "lattice", "remesh", "retopo"].includes(type)
    ? type as MeshModelingModifier["type"]
    : "solidify";
}

function createCopilotModelingModifier(args: Args, index: number): MeshModelingModifier {
  const type = modifierTypeFromArgs(args);
  const id = str(args, "id") || `modifier:${type}:${Date.now()}:${index}`;
  const enabled = bool(args, "enabled") ?? true;
  const label = str(args, "label") || type.charAt(0).toUpperCase() + type.slice(1);

  switch (type) {
    case "boolean":
      return {
        enabled,
        id,
        label,
        mode: (str(args, "mode", "live") === "apply" ? "apply" : "live"),
        operation: (str(args, "operation", "union") || "union") as "difference" | "intersect" | "union",
        targetNodeId: str(args, "targetNodeId") || undefined,
        type
      };
    case "mirror":
      return {
        axis: (str(args, "axis", "x") || "x") as "x" | "y" | "z",
        enabled,
        id,
        label,
        type,
        weld: bool(args, "weld") ?? true
      };
    case "solidify":
      return {
        enabled,
        id,
        label,
        thickness: num(args, "thickness", 0.2),
        type
      };
    case "lattice":
      return {
        axis: (str(args, "axis", "y") || "y") as "x" | "y" | "z",
        enabled,
        falloff: num(args, "falloff", 1),
        id,
        intensity: num(args, "intensity", 0.35),
        label,
        mode: (str(args, "mode", "bend") || "bend") as "bend" | "shear" | "taper" | "twist",
        type
      };
    case "remesh":
      return {
        enabled,
        id,
        label,
        mode: (str(args, "mode", "cleanup") || "cleanup") as "cleanup" | "quad" | "voxel",
        resolution: num(args, "resolution", 32),
        smoothing: num(args, "smoothing", 0.4),
        type,
        weldDistance: num(args, "weldDistance", 0.01)
      };
    case "retopo":
      return {
        enabled,
        id,
        label,
        preserveBorders: bool(args, "preserveBorders") ?? true,
        targetFaceCount: Math.max(1, Math.round(num(args, "targetFaceCount", 128))),
        type
      };
  }
}

function patchCopilotModelingModifier(modifier: MeshModelingModifier, args: Args): MeshModelingModifier {
  const enabled = bool(args, "enabled");
  const label = optionalStr(args, "label");
  const base = {
    ...modifier,
    ...(enabled === undefined ? {} : { enabled }),
    ...(label ? { label } : {})
  };

  switch (base.type) {
    case "boolean":
      return {
        ...base,
        ...(optionalStr(args, "mode") ? { mode: str(args, "mode") as "apply" | "live" } : {}),
        ...(optionalStr(args, "operation") ? { operation: str(args, "operation") as "difference" | "intersect" | "union" } : {}),
        ...(optionalStr(args, "targetNodeId") ? { targetNodeId: str(args, "targetNodeId") } : {})
      };
    case "mirror":
      return {
        ...base,
        ...(optionalStr(args, "axis") ? { axis: str(args, "axis") as "x" | "y" | "z" } : {}),
        ...(bool(args, "weld") === undefined ? {} : { weld: bool(args, "weld")! })
      };
    case "solidify":
      return {
        ...base,
        ...(optionalNum(args, "thickness") === undefined ? {} : { thickness: num(args, "thickness", base.thickness) })
      };
    case "lattice":
      return {
        ...base,
        ...(optionalStr(args, "axis") ? { axis: str(args, "axis") as "x" | "y" | "z" } : {}),
        ...(optionalNum(args, "falloff") === undefined ? {} : { falloff: num(args, "falloff", base.falloff) }),
        ...(optionalNum(args, "intensity") === undefined ? {} : { intensity: num(args, "intensity", base.intensity) }),
        ...(optionalStr(args, "mode") ? { mode: str(args, "mode") as "bend" | "shear" | "taper" | "twist" } : {})
      };
    case "remesh":
      return {
        ...base,
        ...(optionalStr(args, "mode") ? { mode: str(args, "mode") as "cleanup" | "quad" | "voxel" } : {}),
        ...(optionalNum(args, "resolution") === undefined ? {} : { resolution: num(args, "resolution", base.resolution) }),
        ...(optionalNum(args, "smoothing") === undefined ? {} : { smoothing: num(args, "smoothing", base.smoothing) }),
        ...(optionalNum(args, "weldDistance") === undefined ? {} : { weldDistance: num(args, "weldDistance", base.weldDistance) })
      };
    case "retopo":
      return {
        ...base,
        ...(bool(args, "preserveBorders") === undefined ? {} : { preserveBorders: bool(args, "preserveBorders")! }),
        ...(optionalNum(args, "targetFaceCount") === undefined
          ? {}
          : { targetFaceCount: Math.max(1, Math.round(num(args, "targetFaceCount", base.targetFaceCount))) })
      };
  }
}

function gameplayObject(value: unknown): GameplayObject | undefined {
  return isRecord(value) ? value as GameplayObject : undefined;
}

function mergeGameplayObject(base: GameplayObject, patch: unknown): GameplayObject {
  if (!isRecord(patch)) {
    return structuredClone(base);
  }

  const next: GameplayObject = structuredClone(base);

  Object.entries(patch).forEach(([key, value]) => {
    const current = next[key];

    next[key] =
      isRecord(current) && isRecord(value)
        ? mergeGameplayObject(current as GameplayObject, value)
        : structuredClone(value) as GameplayValue;
  });

  return next;
}

function pointFromUnknown(value: unknown): Vec3 | undefined {
  if (Array.isArray(value) && value.length >= 3) {
    const [x, y, z] = value;

    if (typeof x === "number" && typeof y === "number" && typeof z === "number") {
      return { x, y, z };
    }
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (isRecord(value.position)) {
    const { x, y, z } = value.position;

    if (typeof x === "number" && typeof y === "number" && typeof z === "number") {
      return { x, y, z };
    }
  }

  const { x, y, z } = value;

  if (typeof x === "number" && typeof y === "number" && typeof z === "number") {
    return { x, y, z };
  }

  return undefined;
}

function pointArray(value: unknown): Vec3[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const point = pointFromUnknown(entry);
    return point ? [point] : [];
  });
}

function edgeArray(args: Args, key: string): Array<[string, string]> {
  const value = args[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) =>
    Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string"
      ? [[entry[0], entry[1]] as [string, string]]
      : []
  );
}

function colorFromArgs(args: Args): ColorRGBA {
  const hex = str(args, "color", "#ffffff");

  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    const value = Number.parseInt(hex.slice(1), 16);
    return {
      a: clamp01(num(args, "alpha", 1)),
      b: ((value >> 0) & 255) / 255,
      g: ((value >> 8) & 255) / 255,
      r: ((value >> 16) & 255) / 255
    };
  }

  return {
    a: clamp01(num(args, "alpha", 1)),
    b: clamp01(num(args, "b", 1)),
    g: clamp01(num(args, "g", 1)),
    r: clamp01(num(args, "r", 1))
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function ok(data: Record<string, unknown>): string {
  return JSON.stringify({ success: true, ...data });
}

function fail(error: string): string {
  return JSON.stringify({ success: false, error });
}

function buildSceneOutline(editor: EditorCore) {
  const scene = editor.scene;
  const graph = resolveSceneGraph(scene.nodes.values(), scene.entities.values());

  const buildEntityOutline = (entityId: string) => {
    const entity = scene.getEntity(entityId);

    if (!entity) {
      return { id: entityId, missing: true };
    }

    return {
      id: entity.id,
      name: entity.name,
      type: entity.type
    };
  };

  const buildNodeOutline = (nodeId: string): Record<string, unknown> => {
    const node = scene.getNode(nodeId);

    if (!node) {
      return { id: nodeId, missing: true };
    }

    return {
      id: node.id,
      name: node.name,
      kind: node.kind,
      children: (graph.nodeChildrenByParentId.get(nodeId) ?? []).map(buildNodeOutline),
      entities: (graph.entityChildrenByParentId.get(nodeId) ?? []).map(buildEntityOutline)
    };
  };

  return {
    graph,
    outline: {
      totalNodes: scene.nodes.size,
      totalEntities: scene.entities.size,
      rootNodes: graph.rootNodeIds.map(buildNodeOutline),
      rootEntities: graph.rootEntityIds.map(buildEntityOutline)
    }
  };
}

function buildHookCatalog() {
  return HOOK_DEFINITIONS.map((definition) => ({
    ...definition,
    defaultConfig: structuredClone(HOOK_DEFINITION_MAP.get(definition.type)?.defaultConfig ?? {})
  }));
}

function resolvePathId(paths: ScenePathDefinition[], requestedId: string, requestedName: string) {
  const slugSource = requestedId || requestedName || `path_${paths.length + 1}`;
  const baseId = slugSource.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `path_${paths.length + 1}`;
  let nextId = baseId;
  let suffix = 2;

  while (paths.some((pathDefinition) => pathDefinition.id === nextId)) {
    nextId = `${baseId}_${suffix++}`;
  }

  return nextId;
}

function updateHooksOnTarget(
  editor: EditorCore,
  targetKind: "entity" | "node",
  targetId: string,
  update: (hooks: SceneHook[]) => { hooks: SceneHook[]; result: Record<string, unknown> }
): string {
  if (targetKind === "node") {
    const node = editor.scene.getNode(targetId);

    if (!node) {
      return fail("Node not found");
    }

    const currentHooks = structuredClone(node.hooks ?? []);
    const { hooks, result } = update(currentHooks);
    editor.execute(createSetNodeCommand(editor.scene, targetId, { ...structuredClone(node), hooks }));
    return ok(result);
  }

  const entity = editor.scene.getEntity(targetId);

  if (!entity) {
    return fail("Entity not found");
  }

  const currentHooks = structuredClone(entity.hooks ?? []);
  const { hooks, result } = update(currentHooks);
  editor.execute(createSetEntityCommand(editor.scene, targetId, { ...structuredClone(entity), hooks }));
  return ok(result);
}

export function executeTool(
  editor: EditorCore,
  toolCall: CopilotToolCall,
  context: CopilotToolExecutionContext = {}
): CopilotToolResult {
  const { name, args } = toolCall;

  try {
    const result = executeToolInner(editor, name, args, context);
    return { callId: toolCall.id, name, result };
  } catch (error) {
    return {
      callId: toolCall.id,
      name,
      result: fail(error instanceof Error ? error.message : "Unknown error")
    };
  }
}

function executeToolInner(editor: EditorCore, name: string, args: Args, context: CopilotToolExecutionContext): string {
  const scene = editor.scene;

  switch (name) {
    // ── Placement ─────────────────────────────────────────────
    case "place_blockout_room": {
      const { command, groupId, nodeIds } = createPlaceBlockoutRoomCommand(scene, {
        position: vec3(num(args, "x"), num(args, "y"), num(args, "z")),
        size: vec3(num(args, "sizeX", 10), num(args, "sizeY", 4), num(args, "sizeZ", 10)),
        openSides: strArray(args, "openSides") as Array<"bottom" | "east" | "north" | "south" | "top" | "west">,
        materialId: str(args, "materialId") || undefined,
        name: str(args, "name") || undefined
      });
      editor.execute(command);
      return ok({ groupId, nodeIds });
    }

    case "place_blockout_platform": {
      const { command, nodeId } = createPlaceBlockoutPlatformCommand(scene, {
        position: vec3(num(args, "x"), num(args, "y"), num(args, "z")),
        size: vec3(num(args, "sizeX", 8), num(args, "sizeY", 0.5), num(args, "sizeZ", 8)),
        materialId: str(args, "materialId") || undefined,
        name: str(args, "name") || undefined
      });
      editor.execute(command);
      return ok({ nodeId });
    }

    case "place_blockout_stairs": {
      const { command, groupId, nodeIds, topLandingCenter } = createPlaceBlockoutStairCommand(scene, {
        position: vec3(num(args, "x"), num(args, "y"), num(args, "z")),
        stepCount: num(args, "stepCount", 10),
        stepHeight: num(args, "stepHeight", 0.2),
        treadDepth: num(args, "treadDepth", 0.3),
        width: num(args, "width", 2),
        direction: (str(args, "direction") || "north") as "east" | "north" | "south" | "west",
        materialId: str(args, "materialId") || undefined,
        name: str(args, "name") || undefined
      });
      editor.execute(command);
      return ok({ groupId, nodeIds, topLandingCenter });
    }

    case "place_primitive": {
      const role = str(args, "role", "brush") as "brush" | "prop";
      const shape = str(args, "shape", "cube") as "cone" | "cube" | "cylinder" | "sphere";
      const size = vec3(num(args, "sizeX", 2), num(args, "sizeY", shape === "cylinder" || shape === "cone" ? 3 : 2), num(args, "sizeZ", 2));
      const data = createPrimitiveNodeData(role, shape, size);
      const matId = str(args, "materialId");
      if (matId) {
        data.materialId = matId;
      }
      const transform = makeTransform(vec3(num(args, "x"), num(args, "y"), num(args, "z")));
      const label = str(args, "name") || createPrimitiveNodeLabel(role, shape);
      const { command, nodeId } = createPlacePrimitiveNodeCommand(scene, transform, { data, name: label });
      editor.execute(command);
      return ok({ nodeId });
    }

    case "place_brush": {
      const halfX = num(args, "sizeX", 4) * 0.5;
      const halfY = num(args, "sizeY", 3) * 0.5;
      const halfZ = num(args, "sizeZ", 4) * 0.5;
      const transform = makeTransform(vec3(num(args, "x"), num(args, "y"), num(args, "z")));
      const brushData = createAxisAlignedBrushFromBounds({
        x: { min: -halfX, max: halfX },
        y: { min: -halfY, max: halfY },
        z: { min: -halfZ, max: halfZ }
      });
      const meshData = convertBrushToEditableMesh(brushData);

      if (!meshData) {
        return fail("Failed to create mesh box");
      }

      const { command, nodeId } = createPlaceMeshNodeCommand(scene, transform, {
        data: meshData,
        name: str(args, "name") || "Mesh Box"
      });
      editor.execute(command);
      return ok({ nodeId });
    }

    case "place_light": {
      const lightType = str(args, "type", "point") as "ambient" | "directional" | "hemisphere" | "point" | "spot";
      const data = createDefaultLightData(lightType);
      data.castShadow = false;

      if (args.color && typeof args.color === "string") {
        data.color = args.color;
      }

      if (typeof args.intensity === "number") {
        data.intensity = args.intensity;
      }

      const transform = makeTransform(vec3(num(args, "x"), num(args, "y"), num(args, "z")));
      const label = str(args, "name") || createLightNodeLabel(lightType);
      const { command, nodeId } = createPlaceLightNodeCommand(scene, transform, { data, name: label });
      editor.execute(command);
      return ok({ nodeId });
    }

    case "place_entity": {
      const entityType = str(args, "type", "player-spawn") as "npc-spawn" | "player-spawn" | "smart-object";
      const entityCount = Array.from(scene.entities.values()).filter((e) => e.type === entityType).length;
      const entity = createDefaultEntity(entityType, vec3(num(args, "x"), num(args, "y"), num(args, "z")), entityCount);

      if (typeof args.rotationY === "number") {
        entity.transform.rotation.y = args.rotationY as number;
      }

      if (str(args, "name")) {
        entity.name = str(args, "name");
      }

      const command = createPlaceEntityCommand(entity);
      editor.execute(command);
      return ok({ entityId: entity.id });
    }

    case "place_player_spawn": {
      const entityCount = Array.from(scene.entities.values()).filter((e) => e.type === "player-spawn").length;
      const entity = createDefaultEntity("player-spawn", vec3(num(args, "x"), num(args, "y"), num(args, "z")), entityCount);

      if (typeof args.rotationY === "number") {
        entity.transform.rotation.y = args.rotationY as number;
      }

      if (str(args, "name")) {
        entity.name = str(args, "name");
      }

      editor.execute(createPlaceEntityCommand(entity));
      return ok({ entityId: entity.id });
    }

    case "place_skatepark_element": {
      const type = str(args, "type") as SkateparkElementType;
      const width = num(args, "width", 4);
      const height = num(args, "height", 2);
      const length = num(args, "length", 4);
      const materialId = str(args, "materialId") || "concrete-smooth";

      // Register material if needed (skateparkMaterials uses IDs like 'concrete-smooth')
      const existingMat = scene.materials.get(materialId);
      if (!existingMat) {
        const skateMat = skateparkMaterials[materialId];
        if (skateMat) {
          editor.execute(createUpsertMaterialCommand(scene, skateMat));
        }
      }

      let meshData: EditableMesh | undefined;
      const segments = 12;

      switch (type) {
        case "quarter-pipe":
          meshData = buildQuarterPipe({ width, height, radius: length, segments, materialId });
          break;
        case "half-pipe":
          meshData = buildHalfPipe({ width, height, flatLength: length * 0.5, radius: length * 0.5, segments, materialId });
          break;
        case "bank":
          meshData = buildBank({ width, height, depth: length, materialId });
          break;
        case "spine":
          meshData = buildSpine({ width, height, radius: length * 0.5, segments, materialId });
          break;
        case "bowl":
          meshData = buildBowl({ radiusX: width * 0.5, radiusZ: length * 0.5, depth: height, segments, materialId });
          break;
        case "fun-box":
          meshData = buildFunBox({ width, height, length, rampLength: 2, materialId });
          break;
        case "ledge":
          meshData = buildLedge({ width, height, length, materialId });
          break;
        case "manual-pad":
          meshData = buildManualPad({ width, height, length, materialId });
          break;
        case "rail":
          meshData = buildRail({ length, railHeight: height, railRadius: 0.1, legCount: Math.ceil(length / 2), materialId });
          break;
        case "stair-set":
          meshData = buildStairSet({ width, stepCount: Math.floor(height / 0.2), stepDepth: 0.3, stepHeight: 0.2, materialId });
          break;
        case "kicker":
          meshData = buildKicker({ width, height, depth: length, materialId });
          break;
        case "pyramid":
          meshData = buildPyramid({ width, height, length, rampLength: 2, materialId });
          break;
        case "hip":
          meshData = buildHip({ radius: length, height, width, segments, materialId });
          break;
        case "hubba-ledge":
          meshData = buildHubbaLedge({ width, height, length, stairHeight: height * 0.5, materialId });
          break;
      }

      if (!meshData) {
        return fail(`Unsupported skatepark element type: ${type}`);
      }

      meshData.role = "prop";

      const transform = makeTransform(vec3(num(args, "x"), num(args, "y"), num(args, "z")));
      if (typeof args.rotationY === "number") {
        transform.rotation.y = args.rotationY as number;
      }

      const { command, nodeId } = createPlaceMeshNodeCommand(scene, transform, {
        data: meshData,
        name: str(args, "name") || `Skate ${type}`
      });
      editor.execute(command);
      return ok({ nodeId });
    }

    case "place_architecture_element": {
      const type = str(args, "type") as "wall" | "slab" | "ceiling" | "roof" | "item";
      const materialId = str(args, "materialId") || `arch-${type === "item" ? "wall" : type}`;

      // Register architecture default material if needed
      const existingMat = scene.materials.get(materialId);
      if (!existingMat) {
        const archMat = architectureMaterials[materialId];
        if (archMat) {
          editor.execute(createUpsertMaterialCommand(scene, archMat));
        }
      }

      let meshData: EditableMesh | undefined;

      switch (type) {
        case "wall":
          meshData = buildWall({
            width: num(args, "width", 4),
            height: num(args, "height", 3),
            thickness: num(args, "thickness", 0.2),
            materialId
          });
          break;
        case "slab":
          meshData = buildSlab({
            width: num(args, "width", 4),
            depth: num(args, "depth", 4),
            thickness: num(args, "thickness", 0.2),
            materialId
          });
          break;
        case "ceiling":
          meshData = buildCeiling({
            width: num(args, "width", 4),
            depth: num(args, "depth", 4),
            thickness: num(args, "thickness", 0.15),
            height: num(args, "height", 3),
            materialId
          });
          break;
        case "roof":
          meshData = buildRoof({
            width: num(args, "width", 4),
            depth: num(args, "depth", 4),
            pitchAngle: num(args, "pitchAngle", 30),
            overhang: num(args, "overhang", 0.3),
            materialId
          });
          break;
        case "item":
          meshData = buildItem({
            itemType: (str(args, "itemType") || "door") as "door" | "window" | "light-fixture",
            width: num(args, "width", 1),
            height: num(args, "height", 2.1),
            materialId
          });
          break;
      }

      if (!meshData) {
        return fail(`Unsupported architecture element type: ${type}`);
      }

      const transform = makeTransform(vec3(num(args, "x"), num(args, "y"), num(args, "z")));
      if (typeof args.rotationY === "number") {
        transform.rotation.y = args.rotationY as number;
      }

      const typeLabel = type === "item" ? str(args, "itemType", "item") : type;
      const { command, nodeId } = createPlaceMeshNodeCommand(scene, transform, {
        data: meshData,
        name: str(args, "name") || `Architecture: ${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}`
      });
      editor.execute(command);
      return ok({ nodeId });
    }

    // ── Transform ─────────────────────────────────────────────
    case "translate_nodes": {
      const nodeIds = strArray(args, "nodeIds");
      const delta = vec3(num(args, "dx"), num(args, "dy"), num(args, "dz"));
      const command = createTranslateNodesCommand(nodeIds, delta);
      editor.execute(command);
      return ok({});
    }

    case "set_node_transform": {
      const nodeId = str(args, "nodeId");
      const transform = makeTransform(vec3(num(args, "x"), num(args, "y"), num(args, "z")));

      if (typeof args.rotationX === "number") transform.rotation.x = args.rotationX as number;
      if (typeof args.rotationY === "number") transform.rotation.y = args.rotationY as number;
      if (typeof args.rotationZ === "number") transform.rotation.z = args.rotationZ as number;
      if (typeof args.scaleX === "number") transform.scale.x = args.scaleX as number;
      if (typeof args.scaleY === "number") transform.scale.y = args.scaleY as number;
      if (typeof args.scaleZ === "number") transform.scale.z = args.scaleZ as number;

      const command = createSetNodeTransformCommand(scene, nodeId, transform);
      editor.execute(command);
      return ok({});
    }

    case "duplicate_nodes": {
      const nodeIds = strArray(args, "nodeIds");
      const offset = vec3(num(args, "offsetX"), num(args, "offsetY"), num(args, "offsetZ"));
      const { command, duplicateIds } = createDuplicateNodesCommand(scene, nodeIds, offset);
      editor.execute(command);
      return ok({ duplicateIds });
    }

    case "mirror_nodes": {
      const command = createMirrorNodesCommand(strArray(args, "nodeIds"), str(args, "axis", "x") as "x" | "y" | "z");
      editor.execute(command);
      return ok({});
    }

    case "delete_nodes": {
      const command = createDeleteSelectionCommand(scene, strArray(args, "ids"));
      editor.execute(command);
      return ok({});
    }

    // ── Brush ─────────────────────────────────────────────────
    case "split_brush": {
      const { command, splitIds } = createSplitBrushNodesCommand(
        scene,
        strArray(args, "nodeIds"),
        str(args, "axis", "x") as "x" | "y" | "z"
      );
      editor.execute(command);
      return ok({ splitIds });
    }

    case "extrude_brush": {
      const command = createExtrudeBrushNodesCommand(
        scene,
        strArray(args, "nodeIds"),
        str(args, "axis", "y") as "x" | "y" | "z",
        num(args, "amount", 1),
        (String(args.direction ?? "1") === "-1" ? -1 : 1) as -1 | 1
      );
      editor.execute(command);
      return ok({});
    }

    case "offset_brush_face": {
      const command = createOffsetBrushFaceCommand(
        scene,
        str(args, "nodeId"),
        str(args, "axis", "y") as "x" | "y" | "z",
        str(args, "side", "max") as "max" | "min",
        num(args, "amount")
      );
      editor.execute(command);
      return ok({});
    }

    case "assign_material_to_brushes": {
      const command = createAssignMaterialToBrushesCommand(scene, strArray(args, "nodeIds"), str(args, "materialId"));
      editor.execute(command);
      return ok({});
    }

    // ── Materials ─────────────────────────────────────────────
    case "create_material": {
      const materialName = str(args, "name", "Custom Material");
      const slug = materialName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const id = str(args, "id") || `material:custom:${slug}`;
      const material: Material = {
        id,
        name: materialName,
        color: str(args, "color", "#808080"),
        category: (str(args, "category") || "custom") as "blockout" | "custom" | "flat",
        metalness: num(args, "metalness", 0),
        roughness: num(args, "roughness", 0.8)
      };
      const command = createUpsertMaterialCommand(scene, material);
      editor.execute(command);
      return ok({ materialId: id });
    }

    case "assign_material": {
      const targets = (args.targets as Array<{ nodeId: string; faceIds?: string[] }>) ?? [];
      const materialId = str(args, "materialId");
      const command = createAssignMaterialCommand(scene, targets, materialId);
      editor.execute(command);
      return ok({});
    }

    case "set_uv_scale": {
      const targets = (args.targets as Array<{ nodeId: string; faceIds?: string[] }>) ?? [];
      const uvScale = { x: num(args, "scaleX", 1), y: num(args, "scaleY", 1) };
      const command = createSetUvScaleCommand(scene, targets, uvScale);
      editor.execute(command);
      return ok({});
    }

    // ── Scene management ──────────────────────────────────────
    case "group_nodes": {
      const result = createGroupSelectionCommand(scene, strArray(args, "ids"));

      if (!result) {
        return fail("No valid nodes to group");
      }

      editor.execute(result.command);
      return ok({ groupId: result.groupId });
    }

    case "select_nodes": {
      editor.select(strArray(args, "ids"), "object");
      return ok({});
    }

    case "clear_selection": {
      editor.clearSelection();
      return ok({});
    }

    case "undo": {
      editor.undo();
      return ok({});
    }

    case "set_scene_settings": {
      const current = scene.settings;
      const next: SceneSettings = structuredClone(current);

      if (typeof args.gravityX === "number" || typeof args.gravityY === "number" || typeof args.gravityZ === "number") {
        next.world.gravity = vec3(
          num(args, "gravityX", current.world.gravity.x),
          num(args, "gravityY", current.world.gravity.y),
          num(args, "gravityZ", current.world.gravity.z)
        );
      }

      if (typeof args.physicsEnabled === "boolean") next.world.physicsEnabled = args.physicsEnabled;
      if (typeof args.ambientColor === "string") next.world.ambientColor = args.ambientColor as string;
      if (typeof args.ambientIntensity === "number") next.world.ambientIntensity = args.ambientIntensity;
      if (typeof args.fogColor === "string") next.world.fogColor = args.fogColor as string;
      if (typeof args.fogNear === "number") next.world.fogNear = args.fogNear;
      if (typeof args.fogFar === "number") next.world.fogFar = args.fogFar;

      if (typeof args.skyboxEnabled === "boolean") next.world.skybox.enabled = args.skyboxEnabled;
      if (typeof args.skyboxSource === "string") next.world.skybox.source = args.skyboxSource;
      if (args.skyboxFormat === "hdr" || args.skyboxFormat === "image") {
        next.world.skybox.format = args.skyboxFormat;
      }
      if (typeof args.skyboxName === "string") next.world.skybox.name = args.skyboxName;
      if (typeof args.skyboxIntensity === "number") next.world.skybox.intensity = args.skyboxIntensity;
      if (typeof args.skyboxLightingIntensity === "number") {
        next.world.skybox.lightingIntensity = args.skyboxLightingIntensity;
      }
      if (typeof args.skyboxBlur === "number") next.world.skybox.blur = args.skyboxBlur;
      if (typeof args.skyboxAffectsLighting === "boolean") {
        next.world.skybox.affectsLighting = args.skyboxAffectsLighting;
      }

      if (typeof args.grassEnabled === "boolean") next.world.grass.enabled = args.grassEnabled;
      if (typeof args.grassWindSpeed === "number") next.world.grass.windSpeed = args.grassWindSpeed;
      if (typeof args.grassWindStrength === "number") next.world.grass.windStrength = args.grassWindStrength;

      if (typeof args.cameraMode === "string") next.player.cameraMode = args.cameraMode as "fps" | "third-person" | "top-down";
      if (typeof args.playerHeight === "number") next.player.height = args.playerHeight;
      if (typeof args.movementSpeed === "number") next.player.movementSpeed = args.movementSpeed;
      if (typeof args.jumpHeight === "number") next.player.jumpHeight = args.jumpHeight;

      const command = createSetSceneSettingsCommand(scene, next);
      editor.execute(command);
      return ok({});
    }

    case "push_scene_to_connected_game": {
      if (!context.requestScenePush) {
        return fail("Editor-to-game sync is unavailable in this session.");
      }

      context.requestScenePush({
        forceSwitch: bool(args, "forceSwitch") ?? true,
        gameId: str(args, "gameId") || undefined,
        projectName: str(args, "projectName") || undefined,
        projectSlug: str(args, "projectSlug") || undefined
      });
      return ok({ queued: true });
    }

    // ── Read-only queries ─────────────────────────────────────
    case "list_nodes": {
      return JSON.stringify(buildSceneOutline(editor).outline);
    }

    case "list_entities": {
      const entities = Array.from(scene.entities.values()).map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        parentId: e.parentId ?? null
      }));
      return JSON.stringify({ entities });
    }

    case "list_materials": {
      const materials = Array.from(scene.materials.values()).map((m) => ({
        id: m.id,
        name: m.name,
        color: m.color,
        category: m.category
      }));
      return JSON.stringify({ materials });
    }

    case "list_scene_paths": {
      return JSON.stringify({ paths: scene.settings.paths ?? [] });
    }

    case "list_scene_events": {
      return JSON.stringify({ events: resolveGameplayEvents(scene.settings.events ?? []) });
    }

    case "list_hook_types": {
      return JSON.stringify({ hookTypes: buildHookCatalog() });
    }

    case "get_node_details": {
      const node = scene.getNode(str(args, "nodeId"));

      if (!node) {
        return fail("Node not found");
      }

      const { graph } = buildSceneOutline(editor);

      return JSON.stringify({
        id: node.id,
        name: node.name,
        kind: node.kind,
        parentId: node.parentId ?? null,
        childIds: graph.nodeChildrenByParentId.get(node.id) ?? [],
        attachedEntityIds: graph.entityChildrenByParentId.get(node.id) ?? [],
        transform: node.transform,
        worldTransform: graph.nodeWorldTransforms.get(node.id) ?? node.transform,
        tags: node.tags,
        metadata: node.metadata,
        hooks: node.hooks,
        data: node.data
      });
    }

    case "get_entity_details": {
      const entity = scene.getEntity(str(args, "entityId"));

      if (!entity) {
        return fail("Entity not found");
      }

      const { graph } = buildSceneOutline(editor);

      return JSON.stringify({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        parentId: entity.parentId ?? null,
        transform: entity.transform,
        worldTransform: graph.entityWorldTransforms.get(entity.id) ?? entity.transform,
        properties: entity.properties,
        hooks: entity.hooks
      });
    }

    case "get_scene_settings": {
      return JSON.stringify(scene.settings);
    }

    case "create_scene_path": {
      const currentPaths = scene.settings.paths ?? [];
      const points = pointArray(args.points);

      if (points.length === 0) {
        return fail("Path must include at least one valid point");
      }

      const nextPath: ScenePathDefinition = {
        id: resolvePathId(currentPaths, str(args, "id"), str(args, "name")),
        loop: bool(args, "loop") ?? false,
        name: str(args, "name", "Path"),
        points
      };
      const nextSettings: SceneSettings = {
        ...structuredClone(scene.settings),
        paths: [...currentPaths, nextPath]
      };
      editor.execute(createSetSceneSettingsCommand(scene, nextSettings));
      return ok({ path: nextPath });
    }

    case "update_scene_path": {
      const pathId = str(args, "pathId");
      const currentPaths = scene.settings.paths ?? [];
      const existingPath = currentPaths.find((pathDefinition) => pathDefinition.id === pathId);

      if (!existingPath) {
        return fail("Path not found");
      }

      const nextPoints = Array.isArray(args.points) ? pointArray(args.points) : undefined;

      if (Array.isArray(args.points) && (nextPoints?.length ?? 0) === 0) {
        return fail("Path must include at least one valid point");
      }

      const nextPath: ScenePathDefinition = {
        ...structuredClone(existingPath),
        ...(str(args, "name") ? { name: str(args, "name") } : {}),
        ...(typeof args.loop === "boolean" ? { loop: args.loop as boolean } : {}),
        ...(nextPoints ? { points: nextPoints } : {})
      };
      const nextSettings: SceneSettings = {
        ...structuredClone(scene.settings),
        paths: currentPaths.map((pathDefinition) => (pathDefinition.id === pathId ? nextPath : pathDefinition))
      };
      editor.execute(createSetSceneSettingsCommand(scene, nextSettings));
      return ok({ path: nextPath });
    }

    case "delete_scene_path": {
      const pathId = str(args, "pathId");
      const currentPaths = scene.settings.paths ?? [];

      if (!currentPaths.some((pathDefinition) => pathDefinition.id === pathId)) {
        return fail("Path not found");
      }

      const nextSettings: SceneSettings = {
        ...structuredClone(scene.settings),
        paths: currentPaths.filter((pathDefinition) => pathDefinition.id !== pathId)
      };
      editor.execute(createSetSceneSettingsCommand(scene, nextSettings));
      return ok({ pathId });
    }

    case "add_hook": {
      const targetKind = str(args, "targetKind") as "entity" | "node";
      const targetId = str(args, "targetId");
      const hookType = str(args, "hookType");
      const hook = createSceneHook(hookType, {
        defaultPathId: str(args, "defaultPathId") || undefined,
        targetId
      });

      if (!hook) {
        return fail("Unknown hook type");
      }

      const configPatch = gameplayObject(args.config);
      if (configPatch) {
        hook.config = mergeGameplayObject(hook.config, configPatch);
      }

      if (typeof args.enabled === "boolean") {
        hook.enabled = args.enabled as boolean;
      }

      return updateHooksOnTarget(editor, targetKind, targetId, (hooks) => ({
        hooks: [...hooks, hook],
        result: { hook, hookId: hook.id, targetId, targetKind }
      }));
    }

    case "set_hook_value": {
      const targetKind = str(args, "targetKind") as "entity" | "node";
      const targetId = str(args, "targetId");
      const hookId = str(args, "hookId");
      const path = str(args, "path");

      return updateHooksOnTarget(editor, targetKind, targetId, (hooks) => {
        const hookIndex = hooks.findIndex((hook) => hook.id === hookId);

        if (hookIndex === -1) {
          throw new Error("Hook not found");
        }

        const nextHooks = structuredClone(hooks);
        const nextHook = structuredClone(nextHooks[hookIndex]);
        nextHook.config = setGameplayValue(nextHook.config, path, structuredClone(args.value) as GameplayValue);
        nextHooks[hookIndex] = nextHook;

        return {
          hooks: nextHooks,
          result: { hook: nextHook, hookId, path, targetId, targetKind }
        };
      });
    }

    case "remove_hook": {
      const targetKind = str(args, "targetKind") as "entity" | "node";
      const targetId = str(args, "targetId");
      const hookId = str(args, "hookId");

      return updateHooksOnTarget(editor, targetKind, targetId, (hooks) => {
        if (!hooks.some((hook) => hook.id === hookId)) {
          throw new Error("Hook not found");
        }

        return {
          hooks: hooks.filter((hook) => hook.id !== hookId),
          result: { hookId, targetId, targetKind }
        };
      });
    }

    // ── Mesh topology query ─────────────────────────────────
    case "get_mesh_topology": {
      const node = scene.getNode(str(args, "nodeId"));

      if (!node || !isMeshNode(node)) {
        return fail("Node is not a mesh");
      }

      const mesh = node.data;
      const faces = mesh.faces.map((f) => {
        const vIds: string[] = [];
        let he = mesh.halfEdges.find((h) => h.id === f.halfEdge);

        if (he) {
          const startId = he.id;
          do {
            vIds.push(he!.vertex);
            he = mesh.halfEdges.find((h) => h.id === he!.next);
          } while (he && he.id !== startId);
        }

        const faceVertices = getFaceVertices(mesh, f.id);
        const center = faceVertices.reduce(
          (acc, vertex) => ({
            x: acc.x + vertex.position.x,
            y: acc.y + vertex.position.y,
            z: acc.z + vertex.position.z
          }),
          { x: 0, y: 0, z: 0 }
        );
        const normal = faceVertices.length >= 3
          ? computePolygonNormal(faceVertices.map((vertex) => vertex.position))
          : vec3(0, 0, 0);
        const vertexCount = faceVertices.length || 1;

        return {
          id: f.id,
          vertexIds: vIds,
          materialId: f.materialId,
          center: {
            x: center.x / vertexCount,
            y: center.y / vertexCount,
            z: center.z / vertexCount
          },
          normal
        };
      });

      const vertices = mesh.vertices.map((v) => ({
        id: v.id,
        position: v.position
      }));

      const edgeSet = new Set<string>();
      const edges: [string, string][] = [];

      for (const he of mesh.halfEdges) {
        const twin = he.twin ? mesh.halfEdges.find((h) => h.id === he.twin) : undefined;

        if (twin) {
          const key = [he.vertex, twin.vertex].sort().join(":");

          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edges.push([he.vertex, twin.vertex]);
          }
        }
      }

      return JSON.stringify({ faces, vertices, edges });
    }

    // ── Mesh editing ──────────────────────────────────────────
    case "extrude_mesh_faces":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        extrudeEditableMeshFaces(mesh, strArray(args, "faceIds"), num(args, "amount")),
        "Extrude faces"
      );

    case "extrude_mesh_edge":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        extrudeEditableMeshEdge(mesh, [str(args, "vertexId1"), str(args, "vertexId2")], num(args, "amount")),
        "Extrude edge"
      );

      case "bevel_mesh_edges": {
        const edges = (args.edges as string[][] ?? []).map((e) => [e[0], e[1]] as [string, string]);
        return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
          bevelEditableMeshEdges(mesh, edges, num(args, "width"), num(args, "steps", 1),
            (str(args, "profile") || "flat") as "flat" | "round"),
          "Bevel edges"
        );
      }

      case "inset_mesh_faces":
        return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
          insetEditableMeshFaces(mesh, strArray(args, "faceIds"), num(args, "amount", 0.1)),
          "Inset faces"
        );

      case "bridge_mesh_edges": {
        const edges = (args.edges as string[][] ?? []).map((edge) => [edge[0], edge[1]] as [string, string]);
        return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
          bridgeEditableMeshEdges(mesh, edges),
          "Bridge edges"
        );
      }

      case "poke_mesh_faces":
        return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
          pokeEditableMeshFaces(mesh, strArray(args, "faceIds")),
          "Poke faces"
        );

      case "triangulate_mesh_faces":
        return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
          triangulateEditableMeshFaces(mesh, strArray(args, "faceIds").length > 0 ? strArray(args, "faceIds") : undefined),
          "Triangulate faces"
        );

      case "quadrangulate_mesh_faces":
        return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
          quadrangulateEditableMeshFaces(mesh, strArray(args, "faceIds")),
          "Quadrangulate faces"
        );

      case "solidify_mesh":
        return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
          solidifyEditableMesh(mesh, num(args, "thickness", 0.2)),
          "Solidify mesh"
        );

      case "mirror_mesh":
        return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
          mirrorEditableMesh(mesh, str(args, "axis", "x") as "x" | "y" | "z"),
          "Mirror mesh"
        );

      case "weld_mesh_vertices_by_distance":
        return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
          weldEditableMeshVerticesByDistance(
            mesh,
            num(args, "distance", 0.01),
            strArray(args, "vertexIds").length > 0 ? strArray(args, "vertexIds") : undefined
          ),
          "Weld vertices by distance"
        );

      case "weld_mesh_vertices_to_target":
        return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
          weldEditableMeshVerticesToTarget(mesh, str(args, "targetVertexId"), strArray(args, "sourceVertexIds")),
          "Target weld vertices"
        );

      case "subdivide_mesh_face":
        return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
          subdivideEditableMeshFace(mesh, str(args, "faceId"), num(args, "cuts", 1)),
          "Subdivide face"
      );

    case "cut_mesh_face":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        cutEditableMeshFace(mesh, str(args, "faceId"),
          vec3(num(args, "pointX"), num(args, "pointY"), num(args, "pointZ")),
          num(args, "snapSize", 1)),
        "Cut face"
      );

    case "cut_mesh_between_edges": {
      const edges = (args.edges as string[][] ?? []).map((edge) => [edge[0], edge[1]] as [string, string]);
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        cutEditableMeshBetweenEdges(mesh, edges),
        "Cut between edges"
      );
    }

    case "delete_mesh_faces":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        deleteEditableMeshFaces(mesh, strArray(args, "faceIds")),
        "Delete faces"
      );

    case "merge_mesh_faces":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        mergeEditableMeshFaces(mesh, strArray(args, "faceIds")),
        "Merge faces"
      );

    case "merge_mesh_vertices":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        mergeEditableMeshVertices(mesh, strArray(args, "vertexIds")),
        "Merge vertices"
      );

    case "translate_mesh_vertices":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        translateEditableMeshVertices(
          mesh,
          strArray(args, "vertexIds"),
          vec3(num(args, "offsetX"), num(args, "offsetY"), num(args, "offsetZ"))
        ),
        "Translate vertices"
      );

    case "scale_mesh_vertices": {
      const hasPivot = ["pivotX", "pivotY", "pivotZ"].some((key) => typeof args[key] === "number");
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        scaleEditableMeshVertices(
          mesh,
          strArray(args, "vertexIds"),
          vec3(num(args, "scaleX", 1), num(args, "scaleY", 1), num(args, "scaleZ", 1)),
          hasPivot ? vec3(num(args, "pivotX"), num(args, "pivotY"), num(args, "pivotZ")) : undefined
        ),
        "Scale vertices"
      );
    }

    case "fill_mesh_face":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        fillEditableMeshFaceFromVertices(mesh, strArray(args, "vertexIds")),
        "Fill face"
      );

    case "invert_mesh_normals":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        invertEditableMeshNormals(mesh, strArray(args, "faceIds").length > 0 ? strArray(args, "faceIds") : undefined),
        "Invert normals"
      );

    case "arc_mesh_edges": {
      const arcEdges = (args.edges as string[][] ?? []).map((e) => [e[0], e[1]] as [string, string]);
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        arcEditableMeshEdges(mesh, arcEdges, num(args, "offset"), num(args, "segments", 2)),
        "Arc edges"
      );
    }

    case "inflate_mesh": {
      const command = createMeshInflateCommand(scene, strArray(args, "nodeIds"), num(args, "factor"));
      editor.execute(command);
      return ok({});
    }

    case "convert_brush_to_mesh": {
      const nodeId = str(args, "nodeId");
      const node = scene.getNode(nodeId);

      if (!node || !isBrushNode(node)) {
        return fail("Node is not a brush");
      }

      const meshData = convertBrushToEditableMesh(node.data);

      if (!meshData) {
        return fail("Failed to convert brush to mesh");
      }

      const meshNode = {
        ...structuredClone(node),
        kind: "mesh" as const,
        data: meshData
      };

      const command = createReplaceNodesCommand(scene, [meshNode], "convert brush to mesh");
      editor.execute(command);
      return ok({ nodeId });
    }

    case "capture_mesh_modeling_base":
      return executeMeshModelingUpdate(editor, str(args, "nodeId"), (mesh) =>
        captureEditableMeshModelingBase(mesh),
        "Capture mesh modeling base"
      );

    case "rebuild_mesh_modeling_stack":
      return executeMeshModelingUpdate(editor, str(args, "nodeId"), (mesh) =>
        applyEditableMeshModeling(initializeEditableMeshModeling(mesh)),
        "Rebuild mesh modeling stack"
      );

    case "add_mesh_modeling_modifier":
      return executeMeshModelingUpdate(editor, str(args, "nodeId"), (mesh) => {
        const prepared = initializeEditableMeshModeling(mesh);
        const modeling = structuredClone(prepared.modeling ?? {});
        const modifier = createCopilotModelingModifier(args, modeling.modifiers?.length ?? 0);

        return updateEditableMeshModeling(prepared, {
          ...modeling,
          modifiers: [...(modeling.modifiers ?? []), modifier]
        });
      }, "Add mesh modeling modifier");

    case "update_mesh_modeling_modifier":
      return executeMeshModelingUpdate(editor, str(args, "nodeId"), (mesh) => {
        const modifierId = str(args, "modifierId");
        const prepared = initializeEditableMeshModeling(mesh);
        const modeling = structuredClone(prepared.modeling ?? {});
        const modifiers = modeling.modifiers ?? [];

        if (!modifiers.some((modifier) => modifier.id === modifierId)) {
          throw new Error("Modifier not found");
        }

        return updateEditableMeshModeling(prepared, {
          ...modeling,
          modifiers: modifiers.map((modifier) =>
            modifier.id === modifierId ? patchCopilotModelingModifier(modifier, args) : modifier
          )
        });
      }, "Update mesh modeling modifier");

    case "remove_mesh_modeling_modifier":
      return executeMeshModelingUpdate(editor, str(args, "nodeId"), (mesh) => {
        const modifierId = str(args, "modifierId");
        const prepared = initializeEditableMeshModeling(mesh);
        const modeling = structuredClone(prepared.modeling ?? {});
        const modifiers = modeling.modifiers ?? [];

        if (!modifiers.some((modifier) => modifier.id === modifierId)) {
          throw new Error("Modifier not found");
        }

        return updateEditableMeshModeling(prepared, {
          ...modeling,
          modifiers: modifiers.filter((modifier) => modifier.id !== modifierId)
        });
      }, "Remove mesh modeling modifier");

    case "set_mesh_symmetry":
      return executeMeshModelingUpdate(editor, str(args, "nodeId"), (mesh) => {
        const prepared = initializeEditableMeshModeling(mesh);
        const modeling = structuredClone(prepared.modeling ?? {});

        return updateEditableMeshModeling(prepared, {
          ...modeling,
          symmetry: {
            axis: (str(args, "axis", modeling.symmetry?.axis ?? "x") || "x") as "x" | "y" | "z",
            enabled: bool(args, "enabled") ?? modeling.symmetry?.enabled ?? true,
            weld: bool(args, "weld") ?? modeling.symmetry?.weld ?? true
          }
        });
      }, "Set mesh symmetry");

    case "create_mesh_polygroup": {
      const faceIds = uniqueStrings(strArray(args, "faceIds"));

      if (faceIds.length === 0) {
        return fail("faceIds is required");
      }

      return executeMeshModelingUpdate(editor, str(args, "nodeId"), (mesh) => {
        const prepared = initializeEditableMeshModeling(mesh);
        const modeling = structuredClone(prepared.modeling ?? {});
        const index = modeling.polyGroups?.length ?? 0;
        const group: MeshPolyGroup = {
          color: str(args, "color") || MODELING_GROUP_COLORS[index % MODELING_GROUP_COLORS.length],
          faceIds,
          id: str(args, "groupId") || `polygroup:${Date.now()}:${index}`,
          name: str(args, "name") || `PolyGroup ${index + 1}`
        };

        return updateEditableMeshModeling(prepared, {
          ...modeling,
          polyGroups: [...(modeling.polyGroups ?? []), group]
        });
      }, "Create mesh PolyGroup");
    }

    case "assign_faces_to_mesh_polygroup": {
      const groupId = str(args, "groupId");
      const faceIds = uniqueStrings(strArray(args, "faceIds"));

      if (!groupId || faceIds.length === 0) {
        return fail("groupId and faceIds are required");
      }

      return executeMeshModelingUpdate(editor, str(args, "nodeId"), (mesh) => {
        const prepared = initializeEditableMeshModeling(mesh);
        const modeling = structuredClone(prepared.modeling ?? {});
        const groups = modeling.polyGroups ?? [];

        if (!groups.some((group) => group.id === groupId)) {
          throw new Error("PolyGroup not found");
        }

        return updateEditableMeshModeling(prepared, {
          ...modeling,
          polyGroups: groups.map((group) =>
            group.id === groupId
              ? { ...group, faceIds: uniqueStrings([...group.faceIds, ...faceIds]) }
              : group
          )
        });
      }, "Assign faces to mesh PolyGroup");
    }

    case "create_mesh_smoothing_group": {
      const faceIds = uniqueStrings(strArray(args, "faceIds"));

      if (faceIds.length === 0) {
        return fail("faceIds is required");
      }

      return executeMeshModelingUpdate(editor, str(args, "nodeId"), (mesh) => {
        const prepared = initializeEditableMeshModeling(mesh);
        const modeling = structuredClone(prepared.modeling ?? {});
        const index = modeling.smoothingGroups?.length ?? 0;
        const group: MeshSmoothingGroup = {
          angle: num(args, "angle", 45),
          faceIds,
          id: str(args, "groupId") || `smoothing:${Date.now()}:${index}`,
          name: str(args, "name") || `Smooth ${index + 1}`
        };

        return updateEditableMeshModeling(prepared, {
          ...modeling,
          smoothingGroups: [...(modeling.smoothingGroups ?? []), group]
        });
      }, "Create mesh smoothing group");
    }

    case "set_mesh_lod_profiles":
      return executeMeshModelingUpdate(editor, str(args, "nodeId"), (mesh) => {
        const prepared = initializeEditableMeshModeling(mesh);
        const modeling = structuredClone(prepared.modeling ?? {});
        const baseFaceCount = modeling.baseTopology?.faces.length ?? mesh.faces.length;
        const ratioValues = Array.isArray(args.ratios)
          ? args.ratios.filter((value): value is number => typeof value === "number")
          : [];
        const profileRecords = recordArray(args, "profiles");
        const profileInputs: Record<string, unknown>[] = profileRecords.length > 0
          ? profileRecords
          : (ratioValues.length > 0 ? ratioValues : [0.7, 0.4, 0.18]).map((ratio, index) => ({ ratio, name: `LOD ${index + 1}` }));
        const lods: MeshLodProfile[] = profileInputs.map((profile, index) => {
          const ratio = typeof profile.ratio === "number" ? profile.ratio : 0.5;
          const faceCount = typeof profile.faceCount === "number"
            ? Math.max(1, Math.round(profile.faceCount))
            : Math.max(1, Math.round(baseFaceCount * ratio));

          return {
            faceCount,
            generatedAt: new Date().toISOString(),
            id: typeof profile.id === "string" ? profile.id : `lod:${index + 1}`,
            name: typeof profile.name === "string" ? profile.name : `LOD ${index + 1}`,
            ratio
          };
        });

        return updateEditableMeshModeling(prepared, {
          ...modeling,
          lods
        });
      }, "Set mesh LOD profiles");

    case "queue_mesh_bake_outputs": {
      const kinds = uniqueStrings(strArray(args, "kinds"))
        .filter((kind): kind is MeshBakeMapKind => BAKE_MAP_KINDS.includes(kind as MeshBakeMapKind));

      if (kinds.length === 0) {
        return fail("At least one valid bake kind is required");
      }

      return executeMeshModelingUpdate(editor, str(args, "nodeId"), (mesh) => {
        const prepared = initializeEditableMeshModeling(mesh);
        const modeling = structuredClone(prepared.modeling ?? {});
        const replaceExisting = bool(args, "replaceExisting") ?? true;
        const existing = replaceExisting
          ? (modeling.bakeOutputs ?? []).filter((output) => !kinds.includes(output.kind))
          : (modeling.bakeOutputs ?? []);
        const queued = kinds.map((kind) => ({
          generatedAt: new Date().toISOString(),
          id: `bake:${kind}:${Date.now()}`,
          kind,
          resolution: Math.max(128, Math.round(num(args, "resolution", 2048))),
          sourceGroupId: str(args, "sourceGroupId") || undefined,
          status: "queued" as const
        }));

        return updateEditableMeshModeling(prepared, {
          ...modeling,
          bakeOutputs: [...existing, ...queued]
        });
      }, "Queue mesh bake outputs");
    }

    case "unwrap_mesh_uvs": {
      const mode = str(args, "mode", "smart");

      if (mode === "smart") {
        return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
          smartUnwrapEditableMesh(mesh, {
            angleThresholdDegrees: num(args, "angleThresholdDegrees", 66),
            faceIds: strArray(args, "faceIds"),
            margin: num(args, "margin", 0.02)
          }),
          "Smart unwrap mesh UVs"
        );
      }

      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        projectEditableMeshUvs(mesh, {
          axis: optionalStr(args, "axis") as "x" | "y" | "z" | undefined,
          faceIds: strArray(args, "faceIds"),
          mode: (["box", "cylindrical", "planar"].includes(mode) ? mode : "planar") as "box" | "cylindrical" | "planar",
          offset: vec2(num(args, "offsetU"), num(args, "offsetV")),
          scale: vec2(num(args, "scaleU", 1), num(args, "scaleV", 1))
        }),
        "Project mesh UVs"
      );
    }

    case "pack_mesh_uvs":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        packEditableMeshUvs(mesh, {
          faceIds: strArray(args, "faceIds"),
          margin: num(args, "margin", 0.02)
        }),
        "Pack mesh UVs"
      );

    case "mark_mesh_uv_seams":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        markEditableMeshUvSeams(mesh, edgeArray(args, "edges"), { append: bool(args, "append") ?? true }),
        "Mark mesh UV seams"
      );

    case "normalize_mesh_texel_density":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        normalizeEditableMeshTexelDensity(mesh, {
          faceIds: strArray(args, "faceIds"),
          pixelsPerMeter: num(args, "pixelsPerMeter", 512),
          textureResolution: num(args, "textureResolution", 1024)
        }),
        "Normalize mesh texel density"
      );

    case "paint_mesh_face_material":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        paintEditableMeshFacesMaterial(mesh, strArray(args, "faceIds"), str(args, "materialId")),
        "Paint face material"
      );

    case "paint_mesh_vertex_color":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        paintEditableMeshVertexColors(mesh, strArray(args, "faceIds"), colorFromArgs(args), num(args, "strength", 1)),
        "Paint vertex color"
      );

    case "add_mesh_surface_blend_layer":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) => {
        const materialId = str(args, "materialId");
        const material = materialId ? scene.materials.get(materialId) : undefined;
        return upsertEditableMeshBlendLayer(mesh, {
          color: str(args, "color") || material?.color,
          colorTexture: str(args, "colorTexture") || material?.colorTexture,
          id: str(args, "layerId") || `blend:${materialId || Date.now()}`,
          materialId: materialId || undefined,
          metalness: optionalNum(args, "metalness") ?? material?.metalness,
          metalnessTexture: str(args, "metalnessTexture") || material?.metalnessTexture,
          name: str(args, "name") || material?.name || "Surface Blend",
          normalTexture: str(args, "normalTexture") || material?.normalTexture,
          roughness: optionalNum(args, "roughness") ?? material?.roughness,
          roughnessTexture: str(args, "roughnessTexture") || material?.roughnessTexture
        });
      }, "Add mesh surface blend layer");

    case "paint_mesh_texture_blend":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) =>
        paintEditableMeshTextureBlend(mesh, strArray(args, "faceIds"), str(args, "layerId"), num(args, "strength", 1)),
        "Paint texture blend"
      );

    case "add_mesh_projected_decal":
      return executeMeshOp(editor, str(args, "nodeId"), (mesh) => {
        const materialId = str(args, "materialId");
        const material = materialId ? scene.materials.get(materialId) : undefined;
        return {
          ...mesh,
          surface: {
            ...(mesh.surface ?? {}),
            decals: [
              ...(mesh.surface?.decals ?? []),
              {
                blendMode: (str(args, "blendMode", "normal") || "normal") as "add" | "multiply" | "normal",
                color: str(args, "color") || material?.color,
                depth: num(args, "depth", 0.25),
                id: str(args, "decalId") || `decal:${Date.now()}`,
                materialId: materialId || undefined,
                name: str(args, "name") || material?.name || "Projected Decal",
                normal: vec3(num(args, "normalX", 0), num(args, "normalY", 1), num(args, "normalZ", 0)),
                opacity: num(args, "opacity", material?.opacity ?? 1),
                position: vec3(num(args, "x"), num(args, "y"), num(args, "z")),
                size: vec2(num(args, "sizeX", 1), num(args, "sizeY", 1)),
                targetFaceIds: strArray(args, "faceIds"),
                texture: str(args, "texture") || material?.colorTexture,
                up: vec3(num(args, "upX", 0), num(args, "upY", 1), num(args, "upZ", 0))
              }
            ]
          }
        };
      }, "Add projected decal");

    case "split_brush_at_coordinate": {
      const { command, splitIds } = createSplitBrushNodeAtCoordinateCommand(
        scene,
        str(args, "nodeId"),
        str(args, "axis", "x") as "x" | "y" | "z",
        num(args, "coordinate")
      );
      editor.execute(command);
      return ok({ splitIds });
    }

    case "generate_game_html": {
      const title = str(args, "title", "Generated Game");
      context.onGeneratedGame?.(title, "");
      return ok({ registered: true, title });
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}

function executeMeshOp(
  editor: EditorCore,
  nodeId: string,
  op: (mesh: EditableMesh) => EditableMesh | undefined,
  label: string
): string {
  const node = editor.scene.getNode(nodeId);

  if (!node || !isMeshNode(node)) {
    return fail("Node is not a mesh");
  }

  const result = op(node.data);

  if (!result) {
    return fail(`${label} failed`);
  }

  // Preserve authored metadata that topology operators do not know about.
  result.physics = node.data.physics;
  result.role = node.data.role;
  result.modeling = node.data.modeling;
  result.surface = result.surface ?? node.data.surface;

  editor.execute(createSetMeshDataCommand(editor.scene, nodeId, result, node.data));
  return ok({});
}

function executeMeshModelingUpdate(
  editor: EditorCore,
  nodeId: string,
  recipe: (mesh: EditableMesh) => EditableMesh,
  label: string
): string {
  const node = editor.scene.getNode(nodeId);

  if (!node || !isMeshNode(node)) {
    return fail("Node is not a mesh");
  }

  const result = recipe(node.data);

  editor.execute(createSetMeshDataCommand(editor.scene, nodeId, result, node.data));
  return ok({ label });
}
