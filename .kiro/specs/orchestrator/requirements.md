# Orchestrator — Requirements

## Overview

The orchestrator is the main local entrypoint for BLUD development. It launches and coordinates all authoring tools (world editor, animation editor) and running game instances, providing a unified development workflow.

## Functional Requirements

### FR-1: Tool Coordination

- FR-1.1: Launch the world editor preview server
- FR-1.2: Launch the animation editor preview server
- FR-1.3: Start and stop sample or local game projects
- FR-1.4: Build editor preview apps on first run if builds don't exist yet

### FR-2: Tool Switching

- FR-2.1: Provide a UI to switch between the world editor, animation editor, and running game
- FR-2.2: Maintain WebSocket connections between tools and running games for live data push
- FR-2.3: Support opening tools in separate browser tabs or embedded views

### FR-3: Game Project Management

- FR-3.1: Discover and list available game projects in the workspace
- FR-3.2: Start/stop game dev servers
- FR-3.3: Route editor exports and animation bundles to the active game

### FR-4: UI

- FR-4.1: Provide a dashboard-style interface using React, Tailwind, and Space Grotesk font
- FR-4.2: Show status of all managed tools and game instances
- FR-4.3: Provide quick-launch actions for common workflows

## Non-Functional Requirements

### NFR-1: Startup

- NFR-1.1: Start via `bun run start` from the monorepo root
- NFR-1.2: Auto-build editor previews if missing
- NFR-1.3: Serve on port 5000 by default

### NFR-2: Communication

- NFR-2.1: Use WebSocket (ws) for inter-tool communication
- NFR-2.2: Handle tool crashes gracefully without taking down the orchestrator
