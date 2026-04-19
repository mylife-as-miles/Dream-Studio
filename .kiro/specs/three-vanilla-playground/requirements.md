# Three Vanilla Playground — Requirements

## Overview

The Three Vanilla Playground is an isolated app for testing and validating BLUD runtime exports in a plain Three.js environment (no React Three Fiber). It serves as both a validation tool and a reference implementation for consuming runtime content.

## Functional Requirements

### FR-1: Runtime Content Loading

- FR-1.1: Load runtime bundles (`scene.runtime.zip`) exported from the world editor
- FR-1.2: Load unpacked runtime manifests (`scene.runtime.json`)
- FR-1.3: Display loaded scenes in a Three.js viewport

### FR-2: Runtime Integration Validation

- FR-2.1: Exercise `@blud/three-runtime` scene instance creation and disposal
- FR-2.2: Exercise `@blud/gameplay-runtime` for headless gameplay hook consumption
- FR-2.3: Exercise `@blud/runtime-physics-rapier` for physics body creation and sync
- FR-2.4: Exercise `@blud/runtime-audio` for spatial audio playback
- FR-2.5: Exercise `@blud/runtime-scripting` for authored script execution

### FR-3: Interaction

- FR-3.1: Provide basic camera controls for scene navigation
- FR-3.2: Support physics-enabled player movement when Rapier is active
- FR-3.3: Demonstrate host-owned orchestration patterns (renderer lifecycle, physics world, controls)

### FR-4: Development

- FR-4.1: Run standalone via `bun run dev:three-vanilla`
- FR-4.2: Serve on port 5173 by default
- FR-4.3: Support hot reload during development

## Non-Functional Requirements

### NFR-1: Reference Implementation

- NFR-1.1: Demonstrate correct runtime integration patterns for vanilla Three.js consumers
- NFR-1.2: Show that the host application owns renderer, camera, input, physics, and game loop
- NFR-1.3: Validate that runtime packages work without React or R3F dependencies
