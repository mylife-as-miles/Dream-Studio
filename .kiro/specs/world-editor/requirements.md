# World Editor — Requirements

## Overview

The world editor is the primary authoring tool in BLUD. It provides a browser-based level editing experience inspired by Source 2 Hammer, optimized for rapid blockout and iteration of Three.js game levels.

## Functional Requirements

### FR-1: Viewport

- FR-1.1: Provide a real-time 3D viewport using Three.js WebGPU renderer via React Three Fiber
- FR-1.2: Support a perspective editor camera rig with orbit controls
- FR-1.3: Display a snap-driven construction grid with major/minor lines mapped to the active snap size
- FR-1.4: Allow below-ground camera angles
- FR-1.5: Render authored brush, mesh, and model geometry in real time at 60 FPS

### FR-2: Brush Authoring

- FR-2.1: Support creation of convex brush solids defined by plane intersections
- FR-2.2: Provide a staged three-click box creation tool (anchor → base plane → extrusion)
- FR-2.3: Support brush primitives placement from menu bar and scene panel
- FR-2.4: Support brush clipping with snap-aware cut line preview on brush faces
- FR-2.5: Support face and edge extrusion with direct-drag handles
- FR-2.6: Support brush subobject editing (face, edge, vertex) with translate/rotate/scale gizmos

### FR-3: Mesh Editing

- FR-3.1: Support editable polygon meshes with half-edge topology
- FR-3.2: Provide vertex, edge, and face subobject selection and transform
- FR-3.3: Support topology operations: normal inversion (N), face deletion, edge cuts (K), face merge (M)
- FR-3.4: Support interactive edge bevel (B) with flat/round profiles, mouse-width control, and wheel-driven segment count
- FR-3.5: Support shortcut-driven extrusion (X) with axis-lock support for edge extrusions
- FR-3.6: Promote brushes to editable meshes on topology-changing edits

### FR-4: Selection System

- FR-4.1: Support object-level selection via raycast click
- FR-4.2: Support BVH-accelerated raycasting for fast hit testing
- FR-4.3: Support Shift-click additive selection and Shift-drag marquee selection
- FR-4.4: Support direct face and edge picking via transparent overlay polygons and thickened edge hit areas
- FR-4.5: Sync selection between viewport, scene list, and inspector

### FR-5: Transform Tools

- FR-5.1: Provide translate (G), rotate (R), and scale (S) gizmos with mode switching
- FR-5.2: Support grid snapping at sizes 1, 2, 4, 8, 16, 32
- FR-5.3: Support duplication and mirror-by-axis operations
- FR-5.4: Support undo/redo for all transform operations via the command stack

### FR-6: Materials and Assets

- FR-6.1: Provide asset and material panels in the editor UI
- FR-6.2: Support material assignment to brushes with visible viewport color changes
- FR-6.3: Support asset-driven model placement on the grid
- FR-6.4: Support entity authoring (spawn, trigger, light, sound, script)

### FR-7: Persistence and Export

- FR-7.1: Support `.whmap` scene save and load (JSON-based)
- FR-7.2: Support glTF export
- FR-7.3: Support engine-scene runtime export via the worker pipeline
- FR-7.4: Run export and persistence jobs in Web Workers to keep the main thread responsive

### FR-8: Editor UI

- FR-8.1: Use Tailwind CSS and shadcn/ui for the editor interface
- FR-8.2: Provide a floating menu/toolbar/sidebar layout
- FR-8.3: Provide a drag-input-backed transform inspector
- FR-8.4: Show async job status in a bottom-bar affordance with idle/active icon and popover job list

## Non-Functional Requirements

### NFR-1: Performance

- NFR-1.1: Maintain 60 FPS in the viewport with 1000+ objects
- NFR-1.2: Use incremental dirty-node rebuilds, not full-scene recomputation
- NFR-1.3: Use BVH acceleration for all raycasting and selection queries

### NFR-2: Architecture

- NFR-2.1: React is UI only — geometry and editor state live in `editor-core` and `geometry-kernel`
- NFR-2.2: All scene mutations go through the CommandStack for undo/redo
- NFR-2.3: Tool state transitions use xstate state machines
- NFR-2.4: Heavy computation runs in Web Workers

### NFR-3: Browser Compatibility

- NFR-3.1: Support modern browsers with WebGPU capability
- NFR-3.2: Run on macOS, Linux, and Windows
