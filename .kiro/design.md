# BLUD Design Document

## Overview

BLUD is a browser-based game development framework that provides visual authoring tools and runtime packages for building Three.js games. The system is structured as a monorepo with distinct layers: authoring tools (editors), core libraries (geometry, state, rendering), a runtime platform (format, build, adapters), and consumer-facing integration kits.

This document captures the high-level system design, component relationships, data flows, and key design decisions.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPS LAYER                               │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Orchestrator │  │ World Editor │  │  Animation Editor     │  │
│  │              │──│  (React/R3F) │  │  (React/R3F)          │  │
│  │ Coordinates  │  │              │  │                       │  │
│  │ all tools    │  │ Brush/Mesh/  │  │  Graph authoring,     │  │
│  └──────────────┘  │ Asset/Entity │  │  clip import/export   │  │
│                    │ editing      │  └───────────────────────┘  │
│                    └──────┬───────┘                              │
│                           │                                     │
├───────────────────────────┼─────────────────────────────────────┤
│                    CORE PACKAGES                                │
│                           │                                     │
│  ┌────────────────────────▼──────────────────────────────────┐  │
│  │                    Editor Core                            │  │
│  │  SceneDocument │ CommandStack │ Selection │ EventBus      │  │
│  └────────┬───────────────┬──────────────┬───────────────────┘  │
│           │               │              │                      │
│  ┌────────▼────────┐ ┌────▼─────┐ ┌──────▼──────────┐          │
│  │ Geometry Kernel │ │  Tool    │ │ Render Pipeline  │          │
│  │                 │ │  System  │ │                  │          │
│  │ Brush Kernel    │ │ (xstate) │ │ Authoring →      │          │
│  │ Mesh Kernel     │ │          │ │ BufferGeometry   │          │
│  │ Triangulation   │ │ select   │ │ → BVH → render   │          │
│  └─────────────────┘ │ transform│ └──────────────────┘          │
│                       │ clip     │                               │
│                       │ extrude  │                               │
│                       │ mesh edit│                               │
│                       └──────────┘                               │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Shared   │  │   Workers    │  │  Animation Packages      │  │
│  │ Types    │  │ (Web Worker) │  │  anim-core, anim-schema, │  │
│  └──────────┘  └──────────────┘  │  anim-compiler, etc.     │  │
│                                  └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    RUNTIME PLATFORM                             │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Runtime Format  │  │  Runtime Build   │                    │
│  │  (agnostic)      │  │  (headless)      │                    │
│  │                  │  │                  │                    │
│  │  Schema types    │  │  .whmap →        │                    │
│  │  Parse/validate  │◄─│  manifest +      │                    │
│  │  Migrate         │  │  assets          │                    │
│  │  World index     │  │  Bundle pack     │                    │
│  └────────┬─────────┘  └──────────────────┘                    │
│           │                                                     │
│  ┌────────▼─────────┐  ┌──────────────────┐                    │
│  │  Three Runtime   │  │ Gameplay Runtime  │                    │
│  │  (adapter)       │  │ (headless)        │                    │
│  │                  │  │                  │                    │
│  │  Scene instance  │  │  Scene store     │                    │
│  │  Object factory  │  │  Hook resolution │                    │
│  │  World settings  │  │  System registry │                    │
│  │  Asset resolver  │  │  Event bus       │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Streaming       │  │  Physics Rapier  │                    │
│  │  (optional)      │  │  (optional)      │                    │
│  │                  │  │                  │                    │
│  │  World manager   │  │  Rigid bodies    │                    │
│  │  Chunk lifecycle │  │  Colliders       │                    │
│  │  Load/unload     │  │  Sync            │                    │
│  └──────────────────┘  └──────────────────┘                    │
├─────────────────────────────────────────────────────────────────┤
│                    HOST APPLICATION                             │
│                                                                 │
│  Consumer-owned: renderer lifecycle, camera, input, controls,  │
│  physics world, gameplay features, streaming policy, deploy    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Editor Authoring Flow

```
User interaction
  → Tool System (xstate state machine)
    → Editor Core (CommandStack mutation)
      → SceneDocument update
        → Geometry Kernel (brush/mesh recompute)
          → Render Pipeline (triangulate → BufferGeometry → BVH)
            → Three.js viewport render
```

All mutations are undoable. The command stack records every change. Dirty-node tracking ensures only affected geometry is rebuilt.

### Export and Runtime Flow

```
SceneDocument (.whmap)
  → Workers (Web Worker transport)
    → Runtime Build (headless compilation)
      → Runtime Manifest (scene.runtime.json)
      → Asset externalization
      → Optional bundle packing (scene.runtime.zip)
        → Runtime Format (parse, validate, migrate)
          → Three Runtime Adapter (scene instance)
            → Host application (mount, render, play)
```

### Animation Flow

```
Animation Editor
  → Anim Editor Core (document model)
    → Anim Schema (data definitions)
      → Anim Compiler (graph compilation)
        → Anim Exporter (bundle output)
          → Anim Runtime (playback)
            → Anim Three (Three.js adapter)
```

---

## Geometry System Design

### Brush Geometry (Convex Solids)

Brushes are the primary blockout primitive, inspired by Quake/Hammer/Radiant editors.

**Representation**: Intersection of half-spaces, NOT vertex meshes.

```
Brush {
  planes: Plane[]    // Each plane: { normal: Vec3, distance: number }
  faces: Face[]      // Derived from plane intersections
}
```

**Reconstruction algorithm**:
1. For each plane P, intersect with all other plane pairs to find candidate vertices
2. Filter vertices that lie inside all half-spaces (inside test)
3. Sort vertices by angle around face center to form ordered polygons
4. Triangulate for rendering

**Editing operations**: create primitive, clip, extrude face, hollow, split, merge

**Subobject editing**: Face, edge, and vertex selection and transform on brushes. Topology-changing edits promote the brush to an editable mesh.

### Mesh Geometry (Half-Edge)

For complex and organic shapes beyond convex solids.

**Representation**: Half-edge data structure.

```
EditableMesh {
  vertices: Vertex[]
  halfEdges: HalfEdge[]   // { vertex, twin, next, face }
  faces: Face[]
}
```

**Editing operations**: extrude face, delete face, merge vertices, split edge, loop cut, bevel (flat/round profiles with segment control)

### Triangulation

All face polygons are triangulated via `earcut` before rendering. The render pipeline converts authored geometry into `BufferGeometry` with BVH acceleration for fast raycasting and selection.

---

## Editor Core Design

### SceneDocument

The single source of truth for all scene data.

```
SceneDocument {
  nodes: Map<NodeID, GeometryNode>      // Brush, Mesh, or Model
  entities: Map<EntityID, Entity>        // Gameplay objects (spawn, trigger, light, etc.)
  materials: Map<MaterialID, Material>
  assets: Map<AssetID, Asset>            // External resources (models, textures, prefabs)
  layers: Map<LayerID, Layer>
}
```

### CommandStack

Every mutation is wrapped in an undoable command. Supports undo, redo, and command grouping.

### Selection

Supports object-level and subobject-level (face, edge, vertex) selection. Methods: raycast click, shift-click additive, shift-drag marquee.

### EventBus

Editor-wide event dispatch for decoupled communication between systems.

---

## Tool System Design

Tools are modeled as xstate state machines with states:

```
idle → hover → drag → commit / cancel
```

Available tools:
- **Select**: Object and subobject picking
- **Transform**: Move (G), Rotate (R), Scale (S) with grid snapping
- **Clip**: Snap-aware cut lines on brush faces
- **Extrude**: Face and edge extrusion with direct-drag handles (X shortcut in Mesh Edit)
- **Mesh Edit**: Full subobject editing with face/edge/vertex selection, bevel (B), edge cut (K), merge (M), normal invert (N), axis-locked extrusion
- **Asset Place**: Grid-based asset placement from asset panel selection

Grid snap sizes: 1, 2, 4, 8, 16, 32

---

## Runtime Platform Design

### Design Principles

1. **Authored file ≠ runtime contract.** `.whmap` is for the editor. Runtime manifests are the deployable format.
2. **Manifest is the contract.** Renderer-agnostic, versioned, migratable, parseable without Three.js.
3. **Zip is transport.** `scene.runtime.zip` is a convenience artifact, not the primary abstraction.
4. **Three adapter ≠ runtime.** The Three layer translates content into objects. It does not own the game lifecycle.
5. **Gameplay stays headless.** No renderer dependency in gameplay logic.
6. **Host owns orchestration.** The consuming app decides mounting, caching, streaming, physics, and controls.

### Runtime Scene Instance

The primary Three adapter output:

```typescript
type ThreeRuntimeSceneInstance = {
  root: Object3D;
  nodesById: Map<string, Object3D>;
  lights: Object3D[];
  physicsDescriptors: Array<{
    nodeId: string;
    object: Object3D;
    physics: RuntimePhysicsDescriptor;
  }>;
  entities: RuntimeEntity[];
  scene: RuntimeScene;
  dispose: () => void;
};
```

### World Streaming Model

Large worlds use a chunk-based world index:

```
World Index
  └── Chunks[]
        ├── id, bounds, tags
        ├── manifestUrl (scene.runtime.json)
        ├── bundleUrl (optional .zip)
        └── loadDistance / unloadDistance
```

The streaming package manages chunk lifecycle. The host application owns the streaming policy.

---

## Rendering Design

- **Renderer**: Three.js WebGPU renderer
- **Viewport**: React Three Fiber canvas with perspective editor camera rig
- **Acceleration**: three-mesh-bvh for raycasting, selection, and collision queries
- **Grid**: Snap-driven construction grid with major/minor lines mapped to active snap size
- **Gizmos**: Transform controls for translate/rotate/scale with snap awareness
- **Overlays**: Subobject handles (vertex dots, edge lines, face polygons) for mesh/brush editing

---

## State Management

- **Editor state**: valtio (proxy-based reactive state outside React)
- **Tool state machines**: xstate
- **React UI**: Reads from valtio proxies, dispatches commands through editor core
- **No geometry in React state**: React never owns or mutates geometry data

---

## Worker Architecture

Heavy tasks run in Web Workers via `packages/workers`:

| Worker | Tasks |
|--------|-------|
| Geometry Worker | Triangulation, brush rebuild |
| Mesh Worker | Mesh operations |
| Export Worker | .whmap save, glTF export, runtime build |
| Nav Worker | Navmesh generation |

`packages/workers` handles transport and dispatch. `packages/runtime-build` owns the actual build logic.

---

## File Format

### .whmap (Editor Native)

JSON-based scene format containing:
- Scene graph with all geometry nodes
- Entity definitions
- Material assignments
- Asset references
- Layer configuration

Used for save/load and round-tripping. Not deployed to production.

### Runtime Manifest (scene.runtime.json)

The stable content contract. Renderer-agnostic, versioned, migratable. Contains compiled scene data ready for consumption by any adapter.

### Runtime Bundle (scene.runtime.zip)

Packed transport artifact containing the manifest plus embedded assets. Useful for editor downloads, quick validation, and handoff.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Brush-first blockout | Fast level iteration, proven by Hammer/Radiant lineage |
| Half-edge mesh topology | Enables fast traversal, loop selection, and topology operations |
| WebGPU renderer | Future-proof, better performance for complex scenes |
| valtio over Redux/Zustand | Proxy-based reactivity fits the "geometry outside React" rule |
| xstate for tools | Explicit state machines prevent tool interaction bugs |
| Separate runtime-format package | Keeps the content contract renderer-agnostic |
| Optional physics/streaming | Consumers choose their integration, not forced by the framework |
| Monorepo with workspaces | Clear package boundaries, independent versioning via changesets |

---

## Current Development Status

Refer to `ROADMAP.md` for detailed progress. Key highlights:

**Completed**: Viewport, editor core, brush kernel, mesh kernel, BVH selection, transform tools, brush/mesh subobject editing, bevel/cut/merge topology ops, material/asset/entity authoring, .whmap persistence, runtime platform (format, build, adapters, streaming, physics).

**In Progress**: Deeper BVH queries, multi-object gizmo editing, arbitrary-plane clipping, face extrude polish, weld/merge-vertex tools, loop-cut UX, richer asset catalogs, UI polish.
