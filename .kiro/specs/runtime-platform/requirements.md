# Runtime Platform — Requirements

## Overview

The runtime platform is the set of packages that enable BLUD-authored content to be consumed by Three.js games. It spans the content format, build pipeline, renderer adapters, and optional integration kits (streaming, physics).

## Functional Requirements

### FR-1: Runtime Format (`@blud/runtime-format`)

- FR-1.1: Define the canonical runtime scene schema (nodes, entities, materials, assets, layers, world settings)
- FR-1.2: Provide parse, validate, and type-guard helpers for runtime manifests
- FR-1.3: Support schema versioning with migration helpers for backward compatibility
- FR-1.4: Define world index and chunk metadata types for large worlds
- FR-1.5: Must not depend on Three.js, React, Rapier, or any renderer

### FR-2: Runtime Build (`@blud/runtime-build`)

- FR-2.1: Compile `.whmap` authored snapshots into runtime manifests (`scene.runtime.json`)
- FR-2.2: Externalize assets (data URLs → file references)
- FR-2.3: Pack/unpack runtime bundles (`scene.runtime.zip`)
- FR-2.4: Build world indexes for chunked worlds
- FR-2.5: Provide a CLI entrypoint for headless builds (CI, content pipelines)
- FR-2.6: Run in editor workers, CLI tools, or CI environments

### FR-3: Three.js Adapter (`@blud/three-runtime`)

- FR-3.1: Create Three.js objects from runtime scene data via `createThreeRuntimeSceneInstance()`
- FR-3.2: Provide object factories for runtime nodes, instancing, and materials
- FR-3.3: Apply/clear world settings (fog, background, environment) on Three scenes
- FR-3.4: Provide asset resolution hooks for consumer-owned URL resolution
- FR-3.5: Support explicit disposal of textures, object URLs, and scene-owned resources
- FR-3.6: Convenience loader (`loadWebHammerEngineScene()`) wraps the instance API

### FR-4: Gameplay Runtime (`@blud/gameplay-runtime`)

- FR-4.1: Consume runtime scene data without depending on any renderer
- FR-4.2: Provide a scene store, hook target resolution, and system registration
- FR-4.3: Expose an event bus for gameplay events
- FR-4.4: Provide a stable adapter from `RuntimeScene` data into gameplay scene input

### FR-5: Streaming (`@blud/runtime-streaming`)

- FR-5.1: Load and parse world index files
- FR-5.2: Manage chunk lifecycle (load, unload, eviction)
- FR-5.3: Support budgeted concurrency for chunk loading
- FR-5.4: Provide `updateStreamingFocus()` for distance-based chunk management

### FR-6: Physics (`@blud/runtime-physics-rapier`)

- FR-6.1: Create Rapier rigid bodies and colliders from exported physics descriptors
- FR-6.2: Synchronize renderer objects with physics bodies
- FR-6.3: Remain optional — not baked into the Three adapter

## Non-Functional Requirements

### NFR-1: Architecture

- NFR-1.1: Runtime format is renderer-agnostic (Layer 2)
- NFR-1.2: Build pipeline is headless (Layer 3)
- NFR-1.3: Three adapter is an adapter, not the runtime itself (Layer 4)
- NFR-1.4: Streaming and physics are optional integration kits (Layer 5)
- NFR-1.5: Host application owns orchestration (Layer 6)

### NFR-2: API Levels

- NFR-2.1: Level 1 (Data APIs): parse, validate, migrate, inspect manifests
- NFR-2.2: Level 2 (Adapter APIs): create objects, apply settings, resolve assets
- NFR-2.3: Level 3 (Convenience APIs): load from URL, mount scene, create world manager
- NFR-2.4: Level 3 APIs must be built on Level 1 and 2, and must stay replaceable

### NFR-3: Extension Points

- NFR-3.1: Custom node type registry for consumer-defined runtime nodes
- NFR-3.2: Material override hooks for custom shader pipelines
- NFR-3.3: Asset resolution hooks for CDN, auth, caching
- NFR-3.4: Lifecycle hooks for scene instance creation/disposal observation
