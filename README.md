# Dream Studio

Dream Studio is an open-source, browser-based world editor and game tooling monorepo for building Three.js game spaces. It combines a modern level editor, animation authoring tools, a local orchestration app, runtime packages, and a starter CLI into one workflow for moving from blockout to playable web prototype.

The project is built for developers who want editor-grade world authoring without giving up ownership of their game runtime. Dream Studio helps create scenes, geometry, materials, entities, animation data, and runtime bundles, while your game code still owns the render loop, camera, controls, gameplay systems, and deployment model.

> Status: public alpha. APIs, file formats, package boundaries, generated project structure, and editor workflows are expected to change.

## Contents

- [Why Dream Studio](#why-dream-studio)
- [Features](#features)
- [Repository layout](#repository-layout)
- [Technology stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Available applications](#available-applications)
- [Common scripts](#common-scripts)
- [Configuration](#configuration)
- [Core concepts](#core-concepts)
- [Runtime packages](#runtime-packages)
- [Development workflow](#development-workflow)
- [Project status](#project-status)
- [Contributing](#contributing)
- [License](#license)

## Why Dream Studio

Dream Studio exists to make browser game worldbuilding feel fast, inspectable, and code-friendly.

- Author worlds in a browser-based 3D editor instead of hand-writing every mesh, prop, light, and trigger.
- Use brush-style blockout tools inspired by classic level editors, with modern Three.js rendering and web workflows.
- Keep authoring state in framework-agnostic packages, so React is used for UI and the scene model remains portable.
- Export `.whmap`, glTF, and runtime bundle data for use in your own game projects.
- Pair world authoring with animation graph tooling and a CLI-generated starter game.

## Features

### Dream Studio world editor

- Multi-pane 3D editor viewport with perspective and orthographic-style workflows.
- Brush, primitive, mesh, model, light, and entity authoring.
- Blockout room, platform, stair, floor preset, prop, path, and skatepark element placement.
- Object selection, marquee selection, focus controls, duplication, instancing, grouping, mirroring, deletion, and undo/redo.
- Transform gizmos for translate, rotate, and scale with grid snapping.
- Brush editing tools including clipping, extrusion, direct in-canvas brush creation, and topology-changing workflows.
- Mesh edit mode with vertex, edge, and face selection, gizmos, inversion, cuts, beveling, extrusion gestures, and sculpt-style controls.
- Material and texture management with face-level assignment and UV controls.
- Scene hierarchy, inspector, visibility, locking, worker job status, and local draft persistence.
- Physics preview controls for play, simulate, pause, resume, step, possession, and stop flows.
- Save/load support for `.whmap` scene snapshots.
- Export flows for glTF and engine/runtime bundles.
- HTML/JS scene import and GLB import entry points.
- Optional AI-assisted creation panels and copilot flows when provider credentials are configured.

### Animation tooling

- Animation editor for rigs, clips, animation graph documents, preview workflows, and exportable runtime artifacts.
- Package-level animation pipeline covering schemas, compiler, runtime evaluator, Three.js bridge, and importer/exporter utilities.

### Orchestrator

- Local launcher and workflow hub for switching between game projects and editor tools.
- Game sync hooks for pushing authored scenes into a connected development game.
- Copilot-oriented panels and runtime status surfaces for local iteration.

### Runtime and starter tooling

- `create-blud` CLI package for bootstrapping a small Vite + TypeScript game project.
- Runtime packages for scene format validation, Three.js loading, physics adapters, scripting bridges, streaming, audio, and development-time editor sync.

## Repository layout

```text
.
+-- apps/
|   +-- editor/                    # Dream Studio world editor
|   +-- animation-editor/          # Current animation graph editor
|   +-- animation-studio/          # Experimental animation studio app
|   +-- orchestrator/              # Local launcher and game sync hub
|   +-- three-vanilla-playground/  # Three.js runtime playground
|   +-- website/                   # Documentation and marketing site
+-- packages/
|   +-- editor-core/               # Scene document, command stack, selection, events
|   +-- geometry-kernel/           # Brush and editable mesh operations
|   +-- render-pipeline/           # Derived viewport/render data
|   +-- tool-system/               # Tool registry and state-machine primitives
|   +-- workers/                   # Worker task contracts and processing utilities
|   +-- runtime-*                  # Runtime format, build, audio, physics, streaming, scripting
|   +-- anim-*                     # Animation schemas, compiler, runtime, Three.js bridge
|   +-- three-runtime/             # Three.js loader and runtime object factory
|   +-- create-blud/               # Project starter CLI
|   +-- shared/                    # Shared scene types and utilities
+-- scripts/                       # Build and publish helper scripts
+-- ARCHITECTURE.md                # Architecture and geometry kernel reference
+-- RUNTIME_ARCHITECTURE.md        # Runtime architecture notes
+-- ROADMAP.md                     # Implementation progress and known gaps
+-- package.json                   # npm workspace root
```

Published packages currently use the historical `@blud/*` scope. The project and editor are documented publicly as Dream Studio, while BLUD remains visible in package names, the starter CLI, and some older architecture documents.

## Technology stack

- TypeScript
- React
- Vite
- Three.js
- React Three Fiber and Drei
- Tailwind CSS
- shadcn/Base UI-style component primitives
- Valtio for editor UI/app state
- XState-inspired tool-state architecture
- Web Workers and Comlink for expensive editor tasks
- `three-mesh-bvh` for accelerated selection and spatial queries
- `earcut` and `clipper2-ts` for geometry processing
- Rapier and Crashcat-oriented runtime physics packages

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- A modern browser with good WebGL support
- Git
- Optional: Bun, if you want to use the generated starter flow shown by the website docs

The root workspace uses npm workspaces. Run install commands from the repository root.

## Getting started

```bash
git clone <repository-url> dream-studio
cd dream-studio
npm install
```

Start the orchestrator:

```bash
npm start
```

Start Dream Studio directly:

```bash
npm run dev
```

Build the main editor:

```bash
npm run build
```

Typecheck the main editor:

```bash
npm run typecheck
```

## Available applications

### Dream Studio editor

```bash
npm run dev
```

Workspace package: `@blud/editor`  
Path: `apps/editor`

This is the primary world editor. Use it to create and edit scenes, place objects and gameplay entities, preview physics, import/export assets, and produce runtime scene data.

### Orchestrator

```bash
npm start
```

Workspace package: `@blud/orchestrator`  
Path: `apps/orchestrator`

The orchestrator is the recommended entry point when working with an active game project. It provides a local hub for tool launching, game sync, scene pushing, and copilot-related workflows.

### Animation editor

```bash
npm run dev:animation-editor
```

Workspace package: `animation-editor`  
Path: `apps/animation-editor`

Use this app for animation graph authoring, clip workflows, and bundle generation for the runtime animation packages.

### Website

```bash
npm run dev:website
```

Workspace package: `@blud/website`  
Path: `apps/website`

The website explains the framework, starter CLI, project layout, and available tools.

### Three.js playground

```bash
npm run dev:three-vanilla
```

Workspace package: `@blud/three-vanilla-playground`  
Path: `apps/three-vanilla-playground`

This app is a small runtime experimentation surface for validating package behavior outside the full editor.

## Common scripts

| Command | Description |
| --- | --- |
| `npm start` | Run the orchestrator dev server |
| `npm run dev` | Run the Dream Studio editor dev server |
| `npm run dev:all` | Run the editor and Three.js playground workspaces |
| `npm run build` | Build Dream Studio |
| `npm run typecheck` | Typecheck Dream Studio |
| `npm run build:orchestrator` | Build the orchestrator |
| `npm run typecheck:orchestrator` | Typecheck the orchestrator |
| `npm run dev:animation-editor` | Run the animation editor |
| `npm run build:animation-editor` | Build the animation editor |
| `npm run dev:website` | Run the website |
| `npm run build:website` | Build the website |
| `npm run dev:three-vanilla` | Run the Three.js playground |
| `npm run build:packages` | Build publishable packages through the release helper |
| `npm run version:packages` | Apply Changesets version updates |
| `npm run publish:packages:dry-run` | Dry-run package publication |
| `npm run publish:packages` | Publish packages through the release helper |

## Configuration

Most core authoring features run without secrets.

Optional provider-backed features are configured through local environment files. For Dream Studio, create `apps/editor/.env.local` when needed:

```bash
FAL_KEY=your_fal_key
```

Some experimental copilot, model, voice, or generation features may also reference provider SDKs in code. Treat those paths as optional alpha features unless your branch or deployment explicitly documents the required keys.

## Core concepts

### Scene document

The scene document is the source of truth for authored content. It tracks nodes, entities, materials, textures, assets, scene settings, and metadata. React renders controls around the document, but geometry and editor state live in shared packages.

### Geometry nodes

Dream Studio works with several authoring node types:

- Brush nodes for convex blockout and architectural solids.
- Editable mesh nodes for polygon and topology editing.
- Model nodes for imported or referenced assets.
- Primitive and prop-like nodes for fast object placement.
- Light and entity records for gameplay-facing scene behavior.

### Command stack

Editor actions are represented as commands so workflows can support undo, redo, selection sync, and local preview updates.

### Geometry kernel

The geometry kernel handles brush reconstruction, half-space classification, editable mesh topology, triangulation, topology validation, and conversion flows. This keeps geometry logic independent from React UI components.

### Render pipeline

The render pipeline derives viewport-ready Three.js data from authoring nodes. Expensive rebuilds can be cached or routed through workers as the editor grows.

### Runtime export

Dream Studio can save `.whmap` authoring snapshots and export runtime-oriented bundles. The runtime packages are designed to load those artifacts into Three.js game projects while leaving game architecture under your control.

## Runtime packages

The monorepo contains several package families:

| Package family | Purpose |
| --- | --- |
| `@blud/editor-core` | Scene document, commands, selection, editor events |
| `@blud/geometry-kernel` | Brush reconstruction and editable mesh operations |
| `@blud/render-pipeline` | Derived render data and viewport-oriented structures |
| `@blud/tool-system` | Tool registry and tool state primitives |
| `@blud/workers` | Worker task contracts and long-running editor tasks |
| `@blud/shared` | Shared scene types, transforms, materials, entities, and utilities |
| `@blud/runtime-format` | Runtime contracts, parsing, and validation |
| `@blud/runtime-build` | Headless runtime bundle build utilities and CLI |
| `@blud/three-runtime` | Three.js loader and runtime object factory |
| `@blud/game-dev` | Vite development plugin for game projects and editor sync |
| `@blud/gameplay-runtime` | Gameplay runtime primitives and system orchestration |
| `@blud/runtime-audio` | Web Audio adapter with spatial audio support |
| `@blud/runtime-physics-rapier` | Rapier physics adapter |
| `@blud/runtime-physics-crashcat` | Crashcat physics adapter |
| `@blud/runtime-scripting` | Generated custom script runtime bridge |
| `@blud/runtime-streaming` | Chunk and world streaming helpers |
| `@blud/anim-*` | Animation schemas, compiler, runtime, editor core, exporter, and Three.js bridge |
| `create-blud` | CLI for creating starter game projects |

## Development workflow

### Install dependencies

```bash
npm install
```

### Run a focused app

```bash
npm run dev
```

or:

```bash
npm run dev:animation-editor
```

### Validate changes

Run the checks for the area you changed:

```bash
npm run typecheck
npm run build
```

For package work:

```bash
npm run build:packages
```

For app-specific changes, prefer the corresponding `typecheck:*` and `build:*` scripts from the root `package.json`.

### Version packages

This repository includes Changesets:

```bash
npm run changeset
npm run version:packages
```

Dry-run publication before publishing:

```bash
npm run publish:packages:dry-run
```

## Keyboard shortcuts

Common editor shortcuts include:

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Q` | Select tool |
| `W` | Transform translate |
| `E` | Transform rotate |
| `R` | Transform scale |
| `F` | Focus selection |
| `Delete` / `Backspace` | Delete selected objects |
| `Ctrl/Cmd + D` | Duplicate selection |
| `Ctrl/Cmd + I` | Instance selection |
| `Ctrl/Cmd + G` | Group selection |
| `1` to `8` | Switch primary tools |
| `G` / `R` / `S` | Translate, rotate, scale while transforming or mesh editing |
| `V` / `E` / `F` | Vertex, edge, face modes in mesh edit |
| `Alt + P` | Start play preview |
| `Alt + S` | Start simulate preview |
| `Esc` | Stop preview or cancel active gestures |
| `F8` | Toggle preview possession |

## Project status

Dream Studio is usable for experimentation and active development, but it is not stable software yet.

Known alpha characteristics:

- File formats and runtime bundle contracts may change.
- Some menus and panels may be ahead of the underlying implementation.
- Export paths exist, but not every runtime target should be considered production-ready.
- Some AI, copilot, voice, and generation features depend on external providers and may require additional local setup.
- The repository still contains historical names such as Web Hammer and BLUD in package descriptions and architecture docs.

See [ROADMAP.md](ROADMAP.md) for detailed progress and current gaps.

## Contributing

Contributions are welcome.

Before opening a large pull request:

1. Review [ARCHITECTURE.md](ARCHITECTURE.md) and [ROADMAP.md](ROADMAP.md).
2. Open an issue or discussion for major design changes.
3. Keep pull requests focused on one concern when possible.
4. Run the relevant typecheck and build commands.
5. Follow the existing package boundaries: editor UI in apps, reusable authoring/runtime logic in packages.
6. Avoid moving geometry authority into React component state.

Good first contribution areas include documentation, focused editor UI polish, package README improvements, small runtime examples, and targeted bug fixes with reproduction notes.

## Security

This alpha repository does not currently document a formal security policy. Please avoid posting secrets or exploit details in public issues. If a security policy is added later, this section should link to it.

## License

Dream Studio is licensed under the [MIT License](LICENSE).
