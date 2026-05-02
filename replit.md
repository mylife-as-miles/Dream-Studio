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

## Notes

- The editor uses `process` global polyfills in the Vite `define` config for `@babel/types` (used by `@blud/scene-importer`)
- WebGL context errors in the Replit preview are expected (no GPU hardware in sandbox), but the UI renders correctly
- The editor has a full toolbar, Inspector panel, and 3D viewport UI

## Deployment

Configured as a static deployment:
- **Build**: `npm run build -w @blud/editor`
- **Public dir**: `apps/editor/dist`
