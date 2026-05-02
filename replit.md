# Dream Studio - World Editor

A browser-based Source-2-style level editor (web-hammer) for designing game levels with brush solids, mesh editing, asset placement, entity logic, and a realtime 3D viewport.

## Architecture

This is an npm workspace monorepo with:

- **`apps/editor`** — Main editor app (`@blud/editor`), a React + Vite + Three.js/React Three Fiber application
- **`apps/website`** — Marketing website (`@blud/website`)
- **`apps/animation-editor`** — Animation editor
- **`apps/animation-studio`** — Animation studio
- **`apps/orchestrator`** — Orchestrator service
- **`packages/*`** — Internal shared packages (geometry-kernel, editor-core, render-pipeline, etc.)

## Tech Stack

- **Build system**: Vite 8 (with workspace aliases for all internal packages)
- **Framework**: React 19 + TypeScript
- **3D Rendering**: Three.js, @react-three/fiber, @react-three/drei
- **Physics**: @react-three/rapier, @dimforge/rapier3d-compat
- **State**: Valtio
- **UI**: Tailwind CSS v4, shadcn/ui components
- **Package manager**: npm workspaces

## Running the App

The primary workflow runs the editor:

```
npm run dev -w @blud/editor
```

This starts Vite on port 5000 with host `0.0.0.0` and `allowedHosts: true`.

## Key Configuration

- `apps/editor/vite.config.ts` — Vite config with workspace aliases, proxy-friendly settings, and `process` polyfills for babel packages
- `tsconfig.base.json` — Base TypeScript config
- `package.json` — Root workspace config

## Viewport Features

- **Stats Overlay** — Toggle via View menu → "Stats". Renders a `stats-gl` performance overlay (FPS, draw calls, GPU timing) on the active viewport only.
- **Physics Collider Debug** — Toggle via View menu → "Physics Colliders". Passes `debug={true}` to `@react-three/rapier`'s `<Physics>` component, which renders collider wireframes.
- **Orientation Gizmo** — Always visible in the bottom-right corner of every viewport. Implemented via `<GizmoHelper>` + `<GizmoViewport>` from `@react-three/drei`, replacing the old axes helper.
- **Node Material Editor** — Toggle via View menu → "Node Material Editor". Opens a full-screen sheet with a visual node graph (using `@xyflow/react`) showing the selected material's texture/property nodes.
- **AI Behavior Tree Editor** — Toggle via View menu → "Behavior Tree Editor" (Cmd+Shift+B). Full-screen overlay with: left node palette (Composite/Decorator/Leaf node types), center React Flow canvas with auto-layout, right properties panel. Trees are saved/loaded from localStorage keyed by ID. The tree ID matches the `behaviorTreeId` field on the `ai_agent` hook. Node types: Root, Selector, Sequence, Parallel, Inverter, Repeater, Condition, Action.

## Sculpt MVP

The Sculpt tool (`ToolId = "sculpt"`) is fully wired in. Key files:

- **`packages/geometry-kernel/src/mesh/mesh-ops/deform-ops.ts`** — `sculptEditableMeshSamples` (draw/inflate/deflate), `smoothEditableMeshSamples` (Laplacian smooth), `grabEditableMeshSamples` (grab-drag), `buildEditableMeshVertexNeighbors`
- **`apps/editor/src/viewport/ViewportCanvas.tsx`** — `SculptBrushMode` now includes `"draw" | "smooth" | "grab" | "inflate" | "deflate"`. `SculptBrushState` has `symmetryX`, `grabOriginLocal`, `strokeVertexNeighbors`. Auto-enter useEffect fires when `activeToolId === "sculpt"`. Pointer down triggers sculpt for both `mesh-edit` and `sculpt` tools.
- **`apps/editor/src/components/editor-shell/SculptToolBar.tsx`** — Draw / Smooth / Grab brush picker + Mirror X toggle
- **`apps/editor/src/components/editor-shell/icons.tsx`** — `SculptToolIcon`, `DrawBrushIcon`, `SmoothBrushIcon`, `GrabBrushIcon`
- Symmetry X mirrors all brush hits across the world X axis (negate x of hit point/normal/grabOrigin)
- Undo is handled via existing `onUpdateMeshData` → `createSetMeshDataCommand` pipeline (one command per committed stroke)

## Notes

- The editor uses `process` global polyfills in the Vite `define` config for `@babel/types` (used by `@blud/scene-importer`)
- WebGL context errors in the Replit preview are expected (no GPU hardware in sandbox), but the UI renders correctly
- The editor has a full toolbar, Inspector panel, and 3D viewport UI

## Deployment

Configured as a static deployment:
- **Build**: `npm run build -w @blud/editor`
- **Public dir**: `apps/editor/dist`
