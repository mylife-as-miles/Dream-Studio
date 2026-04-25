# Implementation Plan: Worldbuilding Tools

## Overview

This plan implements five worldbuilding and modeling tool categories (Terrain, Foliage, GridMap, Advanced Splines, Advanced Mesh/Modeling) across the BLUD monorepo. Tasks are organized into logical phases: shared types first, then domain packages, editor-core commands, tool system registration, editor UI integration, copilot declarations, performance optimizations, and advanced mesh-edit expansion. Each task builds incrementally on previous work so there is no orphaned code.

## Tasks

- [x] 1. Shared types and node definitions (`@blud/shared`)
  - [x] 1.1 Add TerrainNode type and data types to `packages/shared/src/types.ts`
    - Add `TerrainLayerDefinition`, `TerrainNodeData`, and `TerrainNode` types
    - Add `FalloffType` and `BrushMode` type aliases
    - Include `heightmap` (Float32Array), `resolution`, `size` (Vec3), `splatmap` (Float32Array), `layers`, `lodLevels`, and optional `holeMask` (Uint8Array) fields
    - _Requirements: 1.1_

  - [x] 1.2 Add GridMapNode type and data types to `packages/shared/src/types.ts`
    - Add `TileEntry`, `TilePaletteEntry`, `AutoTileRule`, `GridMapNodeData`, and `GridMapNode` types
    - Include `cellSize` (Vec3), `tiles` (Record<string, TileEntry>), and `palette` fields
    - _Requirements: 13.1_

  - [x] 1.3 Add SplineNode type and data types to `packages/shared/src/types.ts`
    - Add `SplineType`, `SplineInterpolation`, `ControlPoint`, `CrossSectionProfile`, `SplineTerrainIntegration`, `SplineNodeData`, and `SplineNode` types
    - Include `splineType`, `interpolation`, `controlPoints`, `crossSection`, `closed`, `segmentCount`, and optional `terrainIntegration` fields
    - _Requirements: 19.1_

  - [x] 1.4 Extend the `GeometryNode` union and add type guards
    - Add `TerrainNode`, `GridMapNode`, and `SplineNode` to the `GeometryNode` union type
    - Add `isTerrainNode`, `isGridMapNode`, and `isSplineNode` type guard functions
    - Export all new types and guards from `packages/shared/src/index.ts`
    - _Requirements: 1.1, 13.1, 19.1, 28.3_

  - [ ]* 1.5 Write unit tests for new shared types and type guards
    - Test that each type guard correctly identifies its node kind
    - Test that type guards return false for other node kinds
    - Add tests to `packages/shared/src/scene-graph.test.ts`
    - _Requirements: 1.1, 13.1, 19.1_

- [x] 2. Checkpoint — Verify shared types compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Terrain package (`packages/terrain`)
  - [x] 3.1 Initialize the `packages/terrain` package
    - Create `packages/terrain/package.json` with name `@blud/terrain`, dependencies on `@blud/shared` and `three`
    - Create `packages/terrain/tsconfig.json` extending the monorepo base config
    - Create `packages/terrain/src/index.ts` barrel export file
    - _Requirements: 28.1_

  - [x] 3.2 Implement heightmap sculpting operations in `packages/terrain/src/heightmap-ops.ts`
    - Implement `applyRaiseBrush`, `applyLowerBrush`, `applyFlattenBrush`, `applySmoothBrush`, `applyNoiseBrush`, `applyTerraceBrush`, and `applyErosionBrush` functions
    - Each function takes a `Float32Array` heightmap, resolution, brush center (cx, cz), radius, strength, and falloff type, and returns a new `Float32Array`
    - Implement falloff calculation helper for `linear`, `smooth`, and `constant` falloff types
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ]* 3.3 Write unit tests for heightmap sculpting operations
    - Test each brush mode modifies heightmap values correctly within the brush radius
    - Test that values outside the brush radius are unchanged
    - Test falloff curves produce expected attenuation
    - Test flatten brush targets the sampled center height
    - Test smooth brush averages neighboring values
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 3.4 Implement splatmap painting operations in `packages/terrain/src/splatmap-ops.ts`
    - Implement `paintSplatmapLayer` function that increases the weight for a selected layer and proportionally decreases other layers so per-texel weights sum to 1.0
    - _Requirements: 3.1, 3.2_

  - [x] 3.5 Implement hole mask operations in `packages/terrain/src/hole-ops.ts`
    - Implement `applyHoleBrush` function that sets per-cell visibility flags within the brush radius
    - Support both hole (value 1) and un-hole (value 0) modes
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 3.6 Implement terrain mesh generation in `packages/terrain/src/terrain-mesh-gen.ts`
    - Implement `generateTerrainMesh` that converts a heightmap to an `EditableMesh` with vertices, half-edges, and faces
    - Implement `generateTerrainChunkMesh` for chunked mesh generation with LOD level support
    - Exclude cells marked as holes in the `holeMask` from the generated mesh
    - _Requirements: 1.2, 4.3, 6.1_

  - [x] 3.7 Implement LOD mesh generation in `packages/terrain/src/lod.ts`
    - Implement `generateLodMeshes` that produces an array of `EditableMesh` at progressively reduced vertex counts
    - Use the `lodLevels` count from `TerrainNodeData` to determine the number of tiers
    - _Requirements: 6.1, 6.3_

  - [x] 3.8 Implement terrain-spline deformation in `packages/terrain/src/terrain-spline.ts`
    - Implement `applySplineDeformation` that flattens/carves the heightmap along a spline path within a corridor width
    - Return both the modified heightmap and the original values for undo support
    - Support `embedDepth` for river-style carving
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 3.9 Write unit tests for splatmap, hole, mesh generation, and spline deformation
    - Test splatmap weights sum to 1.0 after painting
    - Test hole mask correctly marks/unmarks cells
    - Test terrain mesh generation produces valid vertex/face counts
    - Test spline deformation flattens heightmap within corridor
    - _Requirements: 3.2, 4.2, 5.2, 6.1_

  - [x] 3.10 Export all terrain functions from `packages/terrain/src/index.ts`
    - Re-export all public functions and types from heightmap-ops, splatmap-ops, hole-ops, terrain-mesh-gen, lod, and terrain-spline modules
    - _Requirements: 28.1_

- [-] 4. Foliage package (`packages/foliage`)
  - [-] 4.1 Initialize the `packages/foliage` package
    - Create `packages/foliage/package.json` with name `@blud/foliage`, dependencies on `@blud/shared` and `three`
    - Create `packages/foliage/tsconfig.json` extending the monorepo base config
    - Create `packages/foliage/src/index.ts` barrel export file
    - _Requirements: 28.2_

  - [ ] 4.2 Implement foliage palette types in `packages/foliage/src/foliage-palette.ts`
    - Define `FoliagePaletteEntry` type with `id`, `name`, `meshAssetId`, `minScale`, `maxScale`, `density`, `alignToNormal`, `randomRotationY`, `minSlopeAngle`, `maxSlopeAngle`
    - _Requirements: 8.1_

  - [ ] 4.3 Implement foliage instance storage in `packages/foliage/src/foliage-instance.ts`
    - Define `FoliageInstance` type with `id`, `paletteEntryId`, `position`, `rotation`, `scale`
    - Implement `FoliageInstanceStore` class with `add`, `remove`, and `queryRadius` methods
    - `queryRadius` performs a linear scan for instances within a given radius of a center point
    - _Requirements: 9.1, 10.1, 10.2_

  - [ ] 4.4 Implement GPU instance buffer generation in `packages/foliage/src/gpu-instance-buffer.ts`
    - Define `GpuInstanceGroup` type with `meshAssetId`, `transforms` (Float32Array of 4x4 matrices), and `count`
    - Implement `buildInstanceGroups` that groups instances by mesh asset and builds per-group transform buffers
    - Implement `updateInstanceBuffer` for incremental add/remove updates
    - _Requirements: 11.1, 11.2, 29.2_

  - [ ]* 4.5 Write unit tests for foliage instance storage and GPU buffer generation
    - Test `FoliageInstanceStore.add` and `remove` operations
    - Test `queryRadius` returns correct instances within radius
    - Test `buildInstanceGroups` groups instances by mesh asset correctly
    - Test `updateInstanceBuffer` handles incremental updates
    - _Requirements: 9.1, 10.2, 11.1, 11.2_

  - [ ] 4.6 Export all foliage types and functions from `packages/foliage/src/index.ts`
    - Re-export all public types and functions from foliage-palette, foliage-instance, and gpu-instance-buffer modules
    - _Requirements: 28.2_

- [ ] 5. Checkpoint — Verify terrain and foliage packages compile
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Editor-core commands (`@blud/editor-core`)
  - [ ] 6.1 Implement terrain commands in `packages/editor-core/src/commands/node-commands/terrain-commands.ts`
    - Implement `createPlaceTerrainNodeCommand` following the existing `createPlace*Command` pattern in `placement-commands.ts`
    - Implement `createSculptTerrainCommand` that stores heightmap patches for undo/redo
    - Implement `createPaintTerrainLayerCommand` that stores splatmap patches for undo/redo
    - Implement `createTerrainHoleCommand` that stores hole mask patches for undo/redo
    - Implement `createTerrainSplineDeformCommand` that stores original and modified heightmap data for undo/redo
    - _Requirements: 2.11, 3.4, 4.5, 5.6, 27.1_

  - [ ] 6.2 Implement foliage commands in `packages/editor-core/src/commands/node-commands/foliage-commands.ts`
    - Implement `createPaintFoliageCommand` that adds foliage instances and supports undo by removing them
    - Implement `createEraseFoliageCommand` that removes foliage instances and supports undo by restoring them
    - _Requirements: 9.7, 10.3, 27.2_

  - [ ] 6.3 Implement gridmap commands in `packages/editor-core/src/commands/node-commands/gridmap-commands.ts`
    - Implement `createPlaceGridMapNodeCommand` following the existing placement command pattern
    - Implement `createSetGridMapTilesCommand` that stores tile changes (old and new entries) for undo/redo
    - _Requirements: 15.5, 27.3_

  - [ ] 6.4 Implement spline commands in `packages/editor-core/src/commands/node-commands/spline-commands.ts`
    - Implement `createPlaceSplineNodeCommand` following the existing placement command pattern
    - Implement `createEditSplineCommand` that stores old and new control points for undo/redo
    - Implement `createEditCrossSectionCommand` that stores old and new cross-section profiles for undo/redo
    - _Requirements: 20.5, 21.5, 27.4_

  - [ ] 6.5 Register new command modules in `packages/editor-core/src/commands/node-commands/index.ts`
    - Add re-exports for terrain-commands, foliage-commands, gridmap-commands, and spline-commands
    - _Requirements: 28.4_

  - [ ]* 6.6 Write unit tests for worldbuilding commands
    - Test terrain placement command creates and removes nodes correctly
    - Test sculpt command applies and undoes heightmap patches
    - Test foliage paint/erase commands add/remove instances and undo correctly
    - Test gridmap tile command applies and undoes tile changes
    - Test spline edit command applies and undoes control point changes
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6_

- [ ] 7. Checkpoint — Verify editor-core commands compile
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Tool system registration (`@blud/tool-system`)
  - [ ] 8.1 Extend the `ToolId` union type in `packages/tool-system/src/tools/tool-machine.ts`
    - Add `"terrain"`, `"foliage"`, `"gridmap"`, `"spline-add"`, and `"spline-edit"` to the `ToolId` union
    - _Requirements: 7.1, 12.1, 18.1, 24.1, 28.5_

  - [ ] 8.2 Add new tool entries to the tool registry in `packages/tool-system/src/tools/tool-registry.ts`
    - Add entries: `{ id: "terrain", label: "Terrain" }`, `{ id: "foliage", label: "Foliage" }`, `{ id: "gridmap", label: "GridMap" }`, `{ id: "spline-add", label: "Add Spline" }`, `{ id: "spline-edit", label: "Edit Spline" }`
    - _Requirements: 7.2, 12.2, 18.2, 24.2_

  - [ ] 8.3 Create terrain tool xstate machine in `packages/tool-system/src/tools/terrain-tool-machine.ts`
    - Implement an xstate machine with states: `idle`, `sculpt`, `paint`, `hole`, `spline`
    - Add mode-selection transitions and pointer-event-driven transitions (hover, drag, commit, cancel)
    - _Requirements: 7.3_

  - [ ] 8.4 Create foliage tool xstate machine in `packages/tool-system/src/tools/foliage-tool-machine.ts`
    - Implement an xstate machine with states: `idle`, `paint`, `erase`
    - Add mode toggle transitions and pointer-event-driven transitions
    - _Requirements: 12.3_

  - [ ] 8.5 Create gridmap tool xstate machine in `packages/tool-system/src/tools/gridmap-tool-machine.ts`
    - Implement an xstate machine with states: `idle`, `paint`, `erase`
    - Add mode toggle transitions and pointer-event-driven transitions
    - _Requirements: 18.3_

  - [ ] 8.6 Create spline tool xstate machines in `packages/tool-system/src/tools/spline-tool-machines.ts`
    - Implement `spline-add` machine with states: `idle`, `placing`, `commit` (sequential control point placement, commit on double-click or Enter)
    - Implement `spline-edit` machine with states: `idle`, `hover`, `drag-point`, `drag-tangent`, `commit`
    - _Requirements: 24.3, 24.4_

  - [ ]* 8.7 Write unit tests for new tool machines
    - Test terrain machine transitions between sculpt, paint, hole, and spline modes
    - Test foliage machine toggles between paint and erase
    - Test gridmap machine toggles between paint and erase
    - Test spline-add machine transitions through placing to commit
    - Test spline-edit machine transitions through hover, drag-point, drag-tangent to commit
    - _Requirements: 7.3, 12.3, 18.3, 24.3, 24.4_

- [ ] 9. GridMap tool logic
  - [ ] 9.1 Implement GridMap auto-tiling logic in `packages/editor-core/src/commands/node-commands/gridmap-auto-tile.ts`
    - Implement neighbor adjacency evaluation that selects tile variants and rotations based on `autoTileRules`
    - Implement re-evaluation of adjacent tiles when a tile is placed or removed
    - Support disabling auto-tiling (default behavior: explicit user rotation)
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [ ]* 9.2 Write unit tests for auto-tiling logic
    - Test that placing a tile triggers neighbor re-evaluation
    - Test that auto-tile rules select correct variant and rotation
    - Test that disabled auto-tiling preserves user rotation
    - _Requirements: 16.1, 16.3, 16.4_

- [ ] 10. Advanced spline system
  - [ ] 10.1 Implement spline curve evaluation in `packages/editor-core/src/commands/node-commands/spline-eval.ts`
    - Implement cubic Bezier evaluation using control point tangent handles
    - Implement Catmull-Rom evaluation with auto-computed tangents from neighboring points
    - Implement Frenet frame computation (tangent, normal, binormal) for mesh extrusion orientation
    - _Requirements: 19.1, 20.6_

  - [ ] 10.2 Implement cross-section mesh extrusion in `packages/editor-core/src/commands/node-commands/spline-mesh-gen.ts`
    - Implement mesh extrusion that sweeps a `CrossSectionProfile` along the evaluated spline curve
    - Sample the curve at `segmentCount` evenly-spaced parameter values
    - Orient each cross-section using the Frenet frame
    - Generate an `EditableMesh` compatible with the existing renderer pipeline
    - _Requirements: 21.1, 21.2, 21.3_

  - [ ] 10.3 Implement default cross-section profile presets in `packages/editor-core/src/commands/node-commands/spline-presets.ts`
    - Define default `CrossSectionProfile` presets for each `SplineType`: flat road, fence post-and-rail, circular pipe, rectangular rail, thin cable, thick wall, concave river bed, L-shaped curb
    - _Requirements: 21.4_

  - [ ] 10.4 Implement spline-to-terrain integration in `packages/editor-core/src/commands/node-commands/spline-terrain-integration.ts`
    - Wire `applySplineDeformation` from `@blud/terrain` to flatten/carve terrain when a spline with `terrainIntegration` overlaps a `TerrainNode`
    - Handle terrain restoration when a spline is deleted or moved
    - Push combined spline + terrain deformation as a single undoable command
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

  - [ ] 10.5 Implement spline-to-path integration in `packages/editor-core/src/commands/node-commands/spline-path-sync.ts`
    - Generate a `ScenePathDefinition` from each `SplineNode` by sampling the curve at regular intervals
    - Update the corresponding path in `sceneSettings.paths` when a spline is added or modified
    - Remove the path when a spline is deleted
    - _Requirements: 23.1, 23.2, 23.3_

  - [ ]* 10.6 Write unit tests for spline evaluation, mesh extrusion, and terrain integration
    - Test Bezier and Catmull-Rom curve evaluation produce expected positions
    - Test Frenet frame computation produces orthogonal vectors
    - Test mesh extrusion generates correct vertex count based on segment count and cross-section points
    - Test spline deformation modifies terrain within corridor width
    - Test path sync generates correct ScenePathDefinition points
    - _Requirements: 19.1, 20.6, 21.1, 22.1, 23.1_

- [ ] 11. Checkpoint — Verify all domain logic and commands compile
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Editor UI — ToolPalette controls
  - [ ] 12.1 Add terrain tool palette controls in `apps/editor/src/components/editor-shell/ToolPalette.tsx`
    - Render brush mode selector (raise, lower, flatten, smooth, noise, terrace, erosion), brush radius slider, brush strength slider, falloff selector, and layer palette when the terrain tool is active
    - Wire controls to the terrain tool machine's mode-selection transitions
    - _Requirements: 7.4, 2.3_

  - [ ] 12.2 Add foliage tool palette controls in `apps/editor/src/components/editor-shell/ToolPalette.tsx`
    - Render foliage palette selector, brush radius slider, density override slider, and paint/erase mode toggle when the foliage tool is active
    - Wire controls to the foliage tool machine's mode transitions
    - _Requirements: 12.4_

  - [ ] 12.3 Add gridmap tool palette controls in `apps/editor/src/components/editor-shell/ToolPalette.tsx`
    - Render tile palette selector, cell size inputs, rotation controls, auto-tiling toggle, and paint/erase mode toggle when the gridmap tool is active
    - Wire controls to the gridmap tool machine's mode transitions
    - _Requirements: 18.4_

  - [ ] 12.4 Add spline tool palette controls in `apps/editor/src/components/editor-shell/ToolPalette.tsx`
    - Render spline type selector, interpolation mode toggle, cross-section profile editor, and terrain integration settings when a spline tool is active
    - Wire controls to the spline tool machines
    - _Requirements: 24.5_

- [ ] 13. Editor UI — CreationToolBar integration
  - [ ] 13.1 Add "Worldbuilding" creation group to `apps/editor/src/components/editor-shell/CreationToolBar.tsx`
    - Add a new `CreationGroup` labeled "Worldbuilding" after the "Architecture" group
    - Add "Create Terrain" button that creates a default `TerrainNode` (256×256 resolution, 100×50×100 size) at viewport center and activates the terrain tool
    - Add "Create GridMap" button that creates a default `GridMapNode` (1×1×1 cell size, empty tiles) at viewport center and activates the gridmap tool
    - Add spline type buttons (road, fence, pipe, rail, cable, wall, river, curb) that activate `spline-add` with the type pre-configured
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_

- [ ] 14. Editor UI — Viewport overlays and rendering integration
  - [ ] 14.1 Add terrain viewport rendering in `apps/editor/src/viewport/`
    - Wire terrain mesh generation to the renderer for `TerrainNode` rendering
    - Implement terrain brush cursor overlay showing brush radius and falloff preview
    - Support LOD level selection based on camera distance to terrain chunks
    - Support LOD transition blending to avoid popping artifacts
    - _Requirements: 1.2, 6.2, 6.4_

  - [ ] 14.2 Add foliage GPU instancing rendering in `apps/editor/src/viewport/`
    - Wire `buildInstanceGroups` to the renderer for foliage instance rendering
    - Implement frustum culling for foliage instance groups
    - _Requirements: 11.1, 11.2, 11.4, 29.5_

  - [ ] 14.3 Add gridmap viewport rendering in `apps/editor/src/viewport/`
    - Render 3D grid overlay at the GridMapNode's transform position with cell boundaries
    - Render placed tile meshes at grid cell positions scaled to cell size
    - _Requirements: 13.2, 15.2_

  - [ ] 14.4 Add spline viewport rendering in `apps/editor/src/viewport/`
    - Render spline curves as visible paths with control point handles and tangent handle gizmos
    - Render extruded mesh geometry along the spline
    - _Requirements: 19.2, 20.2, 20.3_

- [ ] 15. Checkpoint — Verify editor UI compiles and renders
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Copilot tool declarations
  - [ ] 16.1 Add worldbuilding tool declarations to `apps/editor/src/lib/copilot/tool-declarations.ts`
    - Add `place_terrain` declaration with parameters: x, y, z, sizeX, sizeY, sizeZ, resolution, name
    - Add `sculpt_terrain` declaration with parameters: nodeId, brushMode, x, z, radius, strength
    - Add `paint_foliage` declaration with parameters: surfaceNodeId, foliageTypeId, x, y, z, radius, densityOverride
    - Add `place_gridmap` declaration with parameters: x, y, z, cellX, cellY, cellZ, name
    - Add `set_gridmap_tile` declaration with parameters: nodeId, gridX, gridY, gridZ, tileId, rotation
    - Add `place_spline` declaration with parameters: splineType, controlPoints, interpolation, terrainIntegration
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6_

  - [ ] 16.2 Implement worldbuilding tool executors in `apps/editor/src/lib/copilot/tool-executor.ts`
    - Add executor cases for each new tool declaration that create the corresponding scene graph nodes and push operations to the CommandStack
    - _Requirements: 26.7_

- [ ] 17. Serialization support
  - [ ] 17.1 Add serialization/deserialization for new node types
    - Implement base64 encoding for `Float32Array` fields (heightmap, splatmap) and `Uint8Array` (holeMask) during `.whmap` save
    - Implement base64 decoding back to typed arrays during `.whmap` load
    - Ensure `TerrainNode`, `GridMapNode`, and `SplineNode` round-trip correctly through save/load
    - _Requirements: 1.3, 1.4, 13.3, 13.4, 19.3, 19.4_

  - [ ]* 17.2 Write unit tests for serialization round-trip
    - Test that heightmap Float32Array survives base64 encode/decode
    - Test that splatmap Float32Array survives base64 encode/decode
    - Test that holeMask Uint8Array survives base64 encode/decode
    - Test that GridMapNode tile data round-trips correctly
    - Test that SplineNode control points round-trip correctly
    - _Requirements: 1.3, 1.4, 13.3, 13.4, 19.3, 19.4_

- [ ] 18. GridMap collision and nav mesh integration
  - [ ] 18.1 Implement collision and nav mesh generation for grid tiles
    - When a tile with `hasCollision: true` is placed, generate a collision shape from the tile mesh and register it with the physics system
    - When a tile with `hasNavMesh: true` is placed, include the tile's walkable surfaces in the scene's navigation mesh data
    - Remove collision shapes and nav mesh contributions when tiles are removed
    - _Requirements: 17.1, 17.2, 17.3_

- [ ] 19. Foliage palette validation and asset warnings
  - [ ] 19.1 Implement foliage and tile palette asset validation in the editor
    - Validate that `meshAssetId` references in foliage palette entries exist in the scene's asset list
    - Validate that `meshAssetId` references in tile palette entries exist in the scene's asset list
    - Display warning indicators next to palette entries with missing asset references
    - Persist foliage palette as part of scene settings in `.whmap` file
    - _Requirements: 8.2, 8.3, 8.4, 14.2, 14.3, 14.4_

- [ ] 20. Performance optimizations
  - [ ] 20.1 Implement Web Worker for terrain sculpting in `apps/editor/src/workers/terrain.worker.ts`
    - Create a Web Worker that receives heightmap `Float32Array` via `Transferable` and performs sculpting operations off the main thread
    - Post modified heightmap data back to the main thread asynchronously
    - _Requirements: 29.1_

  - [ ] 20.2 Implement chunked sculpting for large heightmaps
    - When heightmap resolution exceeds 512×512, process sculpting operations in chunked regions rather than the full heightmap
    - _Requirements: 29.4_

  - [ ] 20.3 Implement frustum culling for worldbuilding geometry
    - Add frustum culling for terrain chunks, foliage instance groups, and gridmap tile clusters
    - Ensure off-screen geometry does not consume draw calls or GPU resources
    - _Requirements: 29.5, 11.4_

  - [ ] 20.4 Implement batched foliage GPU buffer updates
    - Batch instance buffer updates and upload to the GPU in a single operation per frame
    - Avoid per-instance GPU uploads during paint/erase strokes
    - _Requirements: 29.2_

- [ ] 21. Ensure existing path tools remain functional
  - [ ] 21.1 Verify `path-add` and `path-edit` tools still work
    - Ensure the existing `path-add` and `path-edit` tools continue to function for simple linear paths
    - Verify no regressions from the new spline system additions
    - _Requirements: 23.4_

- [ ] 22. Final checkpoint — Full build and test verification
  - Ensure all tests pass, ask the user if questions arise.

## Advanced Modeling Extension Tasks

- [ ] 23. Advanced mesh shared types and metadata (`@blud/shared`)
  - [ ] 23.1 Extend `packages/shared/src/types.ts` with advanced modeling types
    - Add `MeshPolyGroup`, `MeshSmoothingGroup`, `MeshModifier`, `MeshLodEntry`, `MeshBakeArtifact`, and `EditableMeshModelingData`
    - Add an optional `modeling` field to `EditableMesh` for modifier stacks, groups, generated LODs, and bake references
    - _Requirements: 30, 38, 39, 40_

  - [ ] 23.2 Export advanced modeling types from `packages/shared/src/index.ts`
    - Re-export the new mesh-modeling types so `geometry-kernel`, `editor-core`, and `apps/editor` share one contract
    - _Requirements: 30_

  - [ ]* 23.3 Add unit tests for mesh-modeling metadata
    - Test default or optional modeling metadata shapes and backwards compatibility for meshes without advanced metadata
    - _Requirements: 30_

- [ ] 24. Advanced mesh ops in `packages/geometry-kernel`
  - [ ] 24.1 Add boolean, inset, bridge, loop-cut, ring-cut, and knife modules
    - Create modules such as `boolean-ops.ts`, `inset-ops.ts`, `bridge-ops.ts`, `loopcut-ops.ts`, and `knife-ops.ts` under `packages/geometry-kernel/src/mesh/mesh-ops/`
    - Implement destructive topology ops and preview-friendly helpers for live editor interaction
    - _Requirements: 31, 32_

  - [ ] 24.2 Add weld, slide, poke, triangulate, quadrangulate, and solidify ops
    - Implement cleanup and restructuring helpers for `weld by distance`, `target weld`, `slide edge`, `slide vertex`, `poke`, `triangulate`, `quadrangulate`, and `solidify/shell`
    - _Requirements: 33, 34_

  - [ ] 24.3 Add mirror, symmetry, lattice, bend, twist, taper, and shear ops
    - Implement reusable modifier evaluators and geometry helpers for mirror/symmetry and non-destructive deformers
    - _Requirements: 35, 36_

  - [ ] 24.4 Add remesh, retopo, simplify, LOD, and bake helpers
    - Implement voxel/quad remesh helpers, retopo support primitives, simplification and LOD generation helpers, and mesh bake request/result helpers
    - _Requirements: 37, 39, 40_

  - [ ] 24.5 Export advanced mesh ops from `packages/geometry-kernel/src/mesh/mesh-ops/index.ts` and package barrel files
    - Keep the advanced modeling surface discoverable to `editor-core`, the viewport, and copilot tool executors
    - _Requirements: 31, 32, 33, 34, 35, 36, 37, 39, 40_

  - [ ]* 24.6 Write unit tests for advanced mesh ops
    - Cover boolean validity, inset or bridge output, weld behavior, slide constraints, solidify thickness, remesh or simplify helpers, and bake request plumbing
    - _Requirements: 31, 32, 33, 34, 37, 39, 40_

- [ ] 25. Advanced mesh commands in `@blud/editor-core`
  - [ ] 25.1 Add topology operation commands in `packages/editor-core/src/commands/node-commands/`
    - Create dedicated modules such as `mesh-topology-commands.ts` or equivalent for destructive advanced mesh operations
    - Push before or after mesh snapshots through the CommandStack
    - _Requirements: 31, 32, 33, 34_

  - [ ] 25.2 Add modifier-stack, group, LOD, and bake commands
    - Add command modules for mesh modifier stacks, PolyGroup assignment, smoothing-group assignment, LOD attachment, and bake artifact attachment
    - _Requirements: 30, 36, 38, 39, 40_

  - [ ] 25.3 Register advanced mesh command modules in `packages/editor-core/src/commands/node-commands/index.ts`
    - Re-export new command modules alongside the existing `mesh-commands.ts`
    - _Requirements: 30, 41_

  - [ ]* 25.4 Write undo/redo tests for advanced mesh commands
    - Verify destructive ops, modifier stack edits, group assignments, LOD generation, and bake artifact attachment all undo and redo correctly
    - _Requirements: 30, 31, 33, 36, 39, 40_

- [ ] 26. Viewport interaction and transient advanced mesh states
  - [ ] 26.1 Extend `apps/editor/src/viewport/types.ts`
    - Add new `MeshEditToolbarAction` values and transient state types for boolean previews, knife strokes, loop/ring cuts, lattice cages, retopo overlays, and bake/remesh job state
    - _Requirements: 41, 42, 43_

  - [ ] 26.2 Extend `apps/editor/src/viewport/editing.ts`
    - Add helper builders for loop selections, symmetry pairing, deformer handles, retopo snapping, and PolyGroup-aware selection helpers
    - _Requirements: 35, 36, 37, 38, 41_

  - [ ] 26.3 Implement advanced interaction flows in `apps/editor/src/viewport/ViewportCanvas.tsx`
    - Add preview, cancel, and commit flows for boolean operations, knife cuts, loop cuts, lattice deformation, remesh or retopo previews, and async job progress
    - Preserve compatibility with current extrude, bevel, cut, subdivide, and sculpt interactions
    - _Requirements: 31, 32, 35, 36, 37, 41, 43_

- [ ] 27. Editor UI for advanced mesh/modeling tools
  - [ ] 27.1 Expand `apps/editor/src/components/editor-shell/MeshEditToolBars.tsx`
    - Group advanced actions into Boolean, Topology, Cleanup, Deform, Remesh/Retopo, Groups/Shading, LOD, and Bake sections
    - _Requirements: 41_

  - [ ] 27.2 Expand `apps/editor/src/components/editor-shell/ToolPalette.tsx` and `ToolsPanel.tsx`
    - Surface context-sensitive controls and docked-panel access for the new mesh-edit capabilities
    - _Requirements: 41_

  - [ ] 27.3 Expand `apps/editor/src/components/editor-shell/InspectorSidebar.tsx`
    - Add modifier stack management, PolyGroup and smoothing-group editors, LOD preview controls, and bake output panels
    - _Requirements: 30, 38, 39, 40, 41_

- [ ] 28. Copilot support for advanced modeling
  - [ ] 28.1 Add advanced modeling declarations to `apps/editor/src/lib/copilot/tool-declarations.ts`
    - Declare tools such as `boolean_meshes`, `inset_mesh_faces`, `bridge_mesh_edges`, `loop_cut_mesh`, `knife_cut_mesh`, `weld_mesh_vertices`, `slide_mesh_components`, `solidify_mesh`, `mirror_mesh`, `remesh_mesh`, `retopologize_mesh`, `assign_mesh_groups`, `generate_mesh_lods`, and `bake_mesh_maps`
    - _Requirements: 42_

  - [ ] 28.2 Implement advanced modeling executors in `apps/editor/src/lib/copilot/tool-executor.ts`
    - Route advanced modeling tool calls through geometry-kernel helpers and editor-core commands
    - _Requirements: 42_

  - [ ] 28.3 Update mesh-edit guidance in `apps/editor/src/lib/copilot/system-prompt.ts`
    - Treat advanced modeling as part of the preferred high-detail mesh workflow
    - _Requirements: 42_

- [ ] 29. Serialization and asset persistence for advanced modeling
  - [ ] 29.1 Extend `.whmap` serialization for mesh-modeling metadata
    - Persist modifier stacks, PolyGroups, smoothing groups, generated LOD metadata, and bake artifact references for mesh nodes
    - _Requirements: 30, 38, 39, 40_

  - [ ] 29.2 Persist bake outputs into scene asset and material systems
    - Ensure baked texture outputs can be referenced as scene assets or material textures and that baked vertex colors survive save or load
    - _Requirements: 40_

  - [ ]* 29.3 Write round-trip tests for mesh-modeling metadata and bake references
    - Verify advanced mesh metadata survives serialization without breaking legacy meshes
    - _Requirements: 30, 38, 39, 40_

- [ ] 30. Async mesh-processing jobs and caching
  - [ ] 30.1 Implement worker-backed mesh processing jobs
    - Add a worker entry such as `apps/editor/src/workers/mesh-processing.worker.ts` or an equivalent `packages/workers` job module for remesh, simplification, LOD generation, and bake operations
    - _Requirements: 37, 39, 40, 43_

  - [ ] 30.2 Add progress, cancel, and status plumbing to the editor
    - Surface async job status in the viewport or inspector without blocking the rest of the editor
    - _Requirements: 37, 43_

  - [ ] 30.3 Cache evaluated modifier results with selective invalidation
    - Recompute cached boolean, mirror, solidify, deformer, remesh, and simplify previews only when relevant inputs change
    - _Requirements: 30, 31, 36, 43_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical phase boundaries
- The design uses TypeScript throughout — all implementations use TypeScript
- New packages (`@blud/terrain`, `@blud/foliage`) follow existing monorepo patterns
- All scene mutations go through the `CommandStack` for undo/redo support
- `Float32Array` is used for heightmap/splatmap storage for compact memory and Web Worker transferability
