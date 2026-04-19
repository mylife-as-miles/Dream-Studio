# Animation Editor — Requirements

## Overview

The animation editor is a browser-based tool for authoring animation graphs, importing/editing animation clips, and exporting animation bundles for use in BLUD games. It runs as a standalone Vite app and integrates with the orchestrator for live push to running games.

## Functional Requirements

### FR-1: Animation Graph Authoring

- FR-1.1: Provide a node-based graph editor for building animation state machines (via @xyflow/react)
- FR-1.2: Support creating, connecting, and configuring animation graph nodes
- FR-1.3: Support transition conditions between animation states
- FR-1.4: Compile animation graphs via `@blud/anim-compiler` for runtime consumption

### FR-2: Clip Management

- FR-2.1: Import animation clips from external sources (FBX, glTF)
- FR-2.2: Preview animation clips on a 3D character model in the viewport
- FR-2.3: Edit clip timing, blending, and loop settings
- FR-2.4: Export animation clips and bundles via `@blud/anim-exporter`

### FR-3: Character Preview

- FR-3.1: Display a Three.js viewport for real-time animation preview
- FR-3.2: Support importing character models for preview
- FR-3.3: Play back animation graphs with live state transitions

### FR-4: Editor Integration

- FR-4.1: Push animation bundles to a running game via WebSocket connection
- FR-4.2: Integrate with the orchestrator for tool switching
- FR-4.3: Support standalone dev mode (`bun run dev:animation-editor`)

### FR-5: UI

- FR-5.1: Use Tailwind CSS and shadcn/ui components for the interface
- FR-5.2: Provide resizable panels for graph editor, viewport, and properties
- FR-5.3: Provide a command palette (cmdk) for quick actions

## Non-Functional Requirements

### NFR-1: Architecture

- NFR-1.1: Animation data model lives in `@blud/anim-editor-core`, not in React state
- NFR-1.2: Core animation types defined in `@blud/anim-schema`
- NFR-1.3: Runtime playback handled by `@blud/anim-runtime` (headless, no editor dependency)
- NFR-1.4: Three.js adapter in `@blud/anim-three` for renderer-specific playback
