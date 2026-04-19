# BLUD Agent Guide

This document provides the context and rules an AI coding agent needs to work effectively in the BLUD monorepo.

## What Is BLUD

BLUD is a browser-based framework for vibe-coding Three.js games. Think "Next.js for Three.js games." It provides a world editor, an animation editor, runtime packages, an orchestrator, and a path from rough worldbuilding to playable web game prototypes.

The project is in **public alpha**. Expect rapid iteration, breaking changes, renamed APIs, and workflow churn.

## Repository Layout

### Apps

| App | Path | Purpose |
|-----|------|---------|
| Orchestrator | `apps/orchestrator` | Main local entrypoint; launches and coordinates all tools |
| World Editor | `apps/editor` | Browser-based level editor (brush solids, meshes, assets, entities) |
| Animation Editor | `apps/animation-editor` | Animation graph authoring and clip import/export |
| Website | `apps/website` | Docs and onboarding site |
| Three Vanilla Playground | `apps/three-vanilla-playground` | Isolated runtime experimentation app |
| Animation Studio | `apps/animation-studio` | Additional studio app |

### Core Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@blud/editor-core` | `packages/editor-core` | Editor document model, commands, selection, events |
| `@blud/geometry-kernel` | `packages/geometry-kernel` | Brush and mesh operations (the math engine) |
| `@blud/render-pipeline` | `packages/render-pipeline` | Render-facing derived scene contracts |
| `@blud/tool-system` | `packages/tool-system` | Editor tool state machines |
| `@blud/shared` | `packages/shared` | Shared scene types and runtime-facing data structures |
| `@blud/workers` | `packages/workers` | Web Worker transport and dispatch |

### Runtime Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@blud/runtime-format` | `packages/runtime-format` | Canonical runtime schema, parse, validate, migrate |
| `@blud/runtime-build` | `packages/runtime-build` | Headless compilation from `.whmap` to deployable artifacts |
| `@blud/three-runtime` | `packages/three-runtime` | Three.js renderer adapter for runtime content |
| `@blud/gameplay-runtime` | `packages/gameplay-runtime` | Headless gameplay hook runtime |
| `@blud/runtime-streaming` | `packages/runtime-streaming` | Optional chunk/world streaming orchestration |
| `@blud/runtime-physics-rapier` | `packages/runtime-physics-rapier` | Optional Rapier physics bindings |
| `@blud/runtime-physics-crashcat` | `packages/runtime-physics-crashcat` | Alternative physics backend |
| `@blud/runtime-audio` | `packages/runtime-audio` | Runtime audio system |
| `@blud/runtime-scripting` | `packages/runtime-scripting` | Runtime scripting system |
| `@blud/game-dev` | `packages/game-dev` | Game-side dev tooling, scene discovery, editor sync hooks |

### Animation Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@blud/anim-core` | `packages/anim-core` | Core animation data structures |
| `@blud/anim-schema` | `packages/anim-schema` | Animation schema definitions |
| `@blud/anim-compiler` | `packages/anim-compiler` | Animation graph compilation |
| `@blud/anim-runtime` | `packages/anim-runtime` | Animation playback runtime |
| `@blud/anim-three` | `packages/anim-three` | Three.js animation adapter |
| `@blud/anim-exporter` | `packages/anim-exporter` | Animation export pipeline |
| `@blud/anim-utils` | `packages/anim-utils` | Animation utility helpers |
| `@blud/anim-editor-core` | `packages/anim-editor-core` | Animation editor document model |

### Other Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@blud/engine-config` | `packages/engine-config` | Engine configuration |
| `@blud/scene-importer` | `packages/scene-importer` | Scene import utilities |
| `@blud/dev-sync` | `packages/dev-sync` | Dev-time editor sync |
| `@blud/renderer-backend` | `packages/renderer-backend` | Renderer backend abstraction |
| `@blud/physics-backend` | `packages/physics-backend` | Physics backend abstraction |
| `@blud/skatepark` | `packages/skatepark` | Sample game package |
| `create-blud` | `packages/create-blud` | Project scaffolding CLI |

## Technology Stack

- **Runtime**: Bun 1.3+ (primary), Node.js compatible
- **Language**: TypeScript
- **Bundler**: Vite (apps), tsup (packages)
- **UI**: React, Tailwind CSS, shadcn/ui
- **3D Rendering**: Three.js, @react-three/fiber, @react-three/drei, WebGPU renderer
- **Geometry**: earcut, clipper2-ts
- **Spatial**: three-mesh-bvh
- **State**: valtio, xstate
- **Workers**: Web Workers, comlink
- **Physics**: @dimforge/rapier3d-compat
- **Package Management**: npm workspaces, changesets

## Core Architecture Rules

These rules are non-negotiable. Violating them creates bugs that are hard to trace.

1. **React is UI only.** React components render UI and viewport overlays. They do NOT own geometry state, editor document state, or scene data. All authoring state lives in `editor-core`.

2. **Geometry lives in the kernel.** Brush reconstruction, mesh topology, half-edge operations, triangulation — all of it lives in `geometry-kernel`. Never put geometry math in React components or UI code.

3. **Derived render meshes.** The render pipeline consumes authoring geometry and produces Three.js `BufferGeometry`. Authoring data flows one way into rendering. The renderer never writes back to the document.

4. **Worker-backed heavy tasks.** Triangulation, brush rebuilds, navmesh generation, exports, and runtime builds run in Web Workers via `packages/workers`. Keep the main thread responsive.

5. **Incremental rebuilds.** Only rebuild what changed. The editor tracks dirty nodes and only recomputes affected geometry and render data.

6. **Runtime format is renderer-agnostic.** `@blud/runtime-format` owns the canonical runtime types. It must not depend on Three.js, React, Rapier, or any renderer. The Three adapter (`@blud/three-runtime`) depends on the format package, not the other way around.

7. **The host application owns orchestration.** Runtime packages provide adapters and helpers. They do not own the game loop, renderer lifecycle, camera, input, or physics world. The consuming game decides all of that.

## Key File Formats

- **`.whmap`** — Editor-native authored scene format (JSON). For save/load and round-tripping. Not the deployable runtime format.
- **`scene.runtime.json`** — Runtime manifest. The stable content contract between authoring and consumption.
- **`scene.runtime.zip`** — Packed runtime bundle. Convenience transport artifact, not the primary abstraction.

## Common Commands

```bash
# Install dependencies
bun install

# Start the orchestrator (launches all tools)
bun run start

# Dev servers for individual apps
bun run dev                    # World editor
bun run dev:animation-editor   # Animation editor
bun run dev:website            # Docs site
bun run dev:three-vanilla      # Runtime playground

# Build
bun run build                  # World editor
bun run build:orchestrator     # Orchestrator
bun run build:packages         # All publishable packages

# Type checking
bun run typecheck              # World editor
bun run typecheck:orchestrator # Orchestrator
bun run typecheck:animation-editor # Animation editor
```

## Editor Architecture Quick Reference

```
EditorCore
 ├── SceneDocument    — source of truth for all scene data
 ├── CommandStack     — undo/redo with undoable command objects
 ├── Selection        — current selection state
 └── EventBus         — editor-wide event dispatch

GeometryKernel
 ├── BrushKernel      — convex solids defined by plane intersections
 ├── MeshKernel       — half-edge editable polygon meshes
 └── Triangulation    — earcut-based face triangulation

RenderPipeline
 └── Derives Three.js BufferGeometry from authoring nodes

ToolSystem (xstate)
 └── idle → hover → drag → commit/cancel
```

## Brush Geometry Model

Brushes are convex solids defined as intersections of half-spaces, NOT stored as vertex meshes.

```
Brush = { planes: Plane[], faces: Face[] }
Plane = { normal: Vec3, distance: number }
```

Faces are derived from planes via triple-plane intersection, half-space classification, and vertex ordering.

## Editing Conventions

- All scene mutations go through the `CommandStack` for undo/redo support.
- Selection changes go through `Selection` actions.
- Tool state transitions use xstate machines.
- Subobject editing (face/edge/vertex) works on both brushes and editable meshes.
- Topology-changing brush edits promote the brush to an editable mesh.

## Runtime Architecture Layers

1. **Authoring Source** — `.whmap` files, editor-owned
2. **Runtime Format** — `@blud/runtime-format`, renderer-agnostic manifest types
3. **Runtime Build** — `@blud/runtime-build`, headless compilation pipeline
4. **Renderer Adapters** — `@blud/three-runtime`, translates runtime content to Three.js objects
5. **Integration Kits** — `@blud/runtime-streaming`, `@blud/runtime-physics-rapier` (optional)
6. **Host Application** — consumer-owned game/app

## Environment Variables

No env vars required for normal local use. For AI generation features in the world editor, create `apps/editor/.env.local` with `FAL_KEY=your_key`.

## What To Read First

- `ARCHITECTURE.md` — Full editor architecture and geometry kernel specification (source of truth)
- `RUNTIME_ARCHITECTURE.md` — Runtime platform architecture and migration status
- `ROADMAP.md` — Current development status and next steps
- `docs/` — Package and runtime documentation
