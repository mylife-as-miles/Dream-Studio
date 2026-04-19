# BLUD - World Editor

## Project Overview

BLUD (pronounced "GG, Easy") is an opinionated, Next.js-like framework for developing 3D games using Three.js. It provides a monorepo containing a world editor, animation editor, and a set of runtime packages.

The primary application running in this environment is the **BLOB World Editor** (`apps/editor`).

## Tech Stack

- **Languages:** TypeScript, React 19
- **Build Tool:** Vite 8
- **3D Rendering:** Three.js, @react-three/fiber, @react-three/drei
- **Physics:** Rapier (@dimforge/rapier3d-compat)
- **State:** Valtio, XState
- **Styling:** Tailwind CSS v4, Shadcn UI
- **Package Manager:** npm (workspaces monorepo)

## Project Structure

```
apps/
  editor/           # Main World Editor (runs on port 5000)
  orchestrator/     # Dev-time orchestrator (port 4300)
  animation-editor/ # Animation tool
  website/          # Documentation site
  three-vanilla-playground/
packages/
  editor-core/      # Document model, command stack, selection
  engine-config/    # EngineFeatureFlags (all OFF by default; URL/localStorage/env overrides)
  renderer-backend/ # WebGL/WebGPU adapter; RendererFactory with WebGL fallback
  physics-backend/  # Rapier/Jolt adapter; PhysicsFactory (Rapier=stable, Jolt=flag-gated)
  geometry-kernel/  # Math engine for brush solids
  three-runtime/    # Core loader for rendering scenes
  shared/           # Common types
  workers/          # Web workers with Comlink
  ... and more
```

## Running the App

The main workflow runs the editor:
- **Command:** `npm run dev -w @blud/editor`
- **Port:** 5000
- **URL:** http://0.0.0.0:5000

## Vite Config (editor)

The editor vite config (`apps/editor/vite.config.ts`) is configured to:
- Run on host `0.0.0.0` port `5000`
- Allow all hosts (`allowedHosts: true`) for Replit proxy compatibility
- Use workspace aliases to resolve local packages directly from source

## Progressive WebGPU Architecture

Four-phase additive upgrade path. All flags default OFF — editor runs WebGL+Rapier out of the box:

| Package | Purpose |
|---|---|
| `@blud/engine-config` | `EngineFeatureFlags` — all OFF by default; overrides via URL params, localStorage, or `VITE_ENGINE_*` env vars |
| `@blud/renderer-backend` | `RendererAdapter` interface; `WebGLRendererAdapter` (stable); `WebGPURendererAdapter` (scaffold for phases 1-4); `RendererFactory` with automatic WebGL fallback |
| `@blud/physics-backend` | `PhysicsBackend` interface; `RapierPhysicsBackend` (full, editor default); `JoltPhysicsBackend` (stub, NEVER co-active with Rapier); `PhysicsFactory` |

**Bootstrap flow** (`apps/editor/src/lib/engine-bootstrap.ts`):
- `bootstrapEngine()` is awaited in `main.tsx` before `ReactDOM.createRoot().render()`
- Detects WebGPU capability, initialises the active renderer adapter, stores capabilities
- `ViewportCanvas.tsx` reads the adapter via `useRendererGlConfig()` hook → passes result as `gl=` prop to R3F `<Canvas>` (undefined → WebGL, factory fn → WebGPU)

**Critical rules (never violate):**
- WebGPU is always optional — WebGL fallback is always enabled
- Rapier remains the authoritative editor physics via `@react-three/rapier` React components (unchanged)
- Jolt is a feature-flagged runtime-only backend, NEVER loaded in the same world as Rapier

## Deployment

Configured as a static site:
- **Build:** `npm run build -w @blud/editor`
- **Public Dir:** `apps/editor/dist`
