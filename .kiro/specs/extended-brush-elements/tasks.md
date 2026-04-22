# Implementation Plan: Extended Brush Elements (Architecture Category)

## Overview

This plan adds an "Architecture" creation category to the BLUD world editor. It follows the established `@blud/skatepark` pattern: a new `packages/architecture` package exports geometry builder functions and default materials, while the editor shell integrates a new "Architecture" group into the `CreationToolBar`. The implementation proceeds bottom-up — shared types first, then the package with builders and materials, then editor integration (icons, toolbar, placement flow, non-geometry elements, and export exclusion).

## Tasks

- [x] 1. Add `ArchitectureElementType` to `@blud/shared`
  - [x] 1.1 Define the `ArchitectureElementType` union type in `packages/shared/src/types.ts`
    - Add `export type ArchitectureElementType = "wall" | "slab" | "ceiling" | "roof" | "zone" | "item" | "guide" | "scan";` alongside the existing `SkateparkElementType`
    - _Requirements: 1.1, 1.2_

- [-] 2. Create the `@blud/architecture` package with geometry builders and materials
  - [x] 2.1 Scaffold the `packages/architecture` package
    - Create `packages/architecture/package.json` following the `@blud/skatepark` pattern with dependencies on `@blud/shared` and `@blud/geometry-kernel`
    - Create `packages/architecture/tsconfig.json` matching the skatepark tsconfig
    - Create `packages/architecture/src/index.ts` re-exporting all builders and materials
    - _Requirements: 3.1, 4.1, 5.1, 6.1, 8.1, 11.1_

  - [x] 2.2 Implement `buildWall` geometry builder
    - Create `packages/architecture/src/geometry/wall.ts`
    - Accept `{ width, height, thickness, materialId? }` and return an `EditableMesh` with 6 faces forming a closed rectangular solid
    - Center on local origin along width axis, base at y=0, extending upward along positive y-axis
    - Clamp zero/negative dimensions to 0.1 minimum
    - Use `createEditableMeshFromPolygons` from `@blud/geometry-kernel`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [-] 2.3 Implement `buildSlab` geometry builder
    - Create `packages/architecture/src/geometry/slab.ts`
    - Accept `{ width, depth, thickness, materialId? }` and return an `EditableMesh` with 6 faces forming a horizontal rectangular solid with top face at y=0
    - Clamp zero/negative dimensions to 0.1 minimum
    - _Requirements: 4.1, 4.2, 4.3_

  - [~] 2.4 Implement `buildCeiling` geometry builder
    - Create `packages/architecture/src/geometry/ceiling.ts`
    - Accept `{ width, depth, thickness, height, materialId? }` and return an `EditableMesh` with 6 faces, bottom face at the specified height offset
    - Clamp zero/negative dimensions to 0.1 minimum
    - _Requirements: 5.1, 5.2, 5.3_

  - [~] 2.5 Implement `buildRoof` geometry builder
    - Create `packages/architecture/src/geometry/roof.ts`
    - Accept `{ width, depth, pitchAngle, overhang, materialId? }` and return an `EditableMesh`
    - When `pitchAngle` is 0, produce a flat horizontal slab
    - When `pitchAngle` is >0 and ≤89, produce a pitched gabled roof with two sloped faces meeting at a ridge along the depth axis
    - When `overhang` > 0, extend geometry beyond base width/depth by overhang distance on each side
    - Clamp `pitchAngle` to [0, 89], clamp dimensions to 0.1 minimum
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [~] 2.6 Implement `buildItem` geometry builder
    - Create `packages/architecture/src/geometry/item.ts`
    - Accept `{ itemType: "door" | "window" | "light-fixture", width, height, materialId? }` and return an `EditableMesh`
    - Door: rectangular opening frame with specified width and height
    - Window: rectangular frame offset vertically to default sill height of 0.9 units
    - _Requirements: 8.1, 8.2, 8.3_

  - [~] 2.7 Implement `architectureMaterials` default materials
    - Create `packages/architecture/src/materials.ts`
    - Export `architectureMaterials: Record<string, Material>` with entries for `arch-wall` (#C8C8C8), `arch-slab` (#A0A0A0), `arch-ceiling` (#E8E8E8), `arch-roof` (#B86F50)
    - Follow the same `Material` shape as `skateparkMaterials`
    - _Requirements: 11.1, 11.3_

  - [ ]* 2.8 Write unit tests for geometry builders
    - Test `buildWall`, `buildSlab`, `buildCeiling`, `buildRoof`, and `buildItem` with valid dimensions
    - Test dimension clamping for zero/negative values
    - Test `buildRoof` pitch angle clamping and overhang extension
    - Test `buildItem` window sill height offset
    - Verify each builder returns an `EditableMesh` with the expected face count
    - _Requirements: 3.1–3.4, 4.1–4.3, 5.1–5.3, 6.1–6.5, 8.1–8.3_

- [ ] 3. Checkpoint — Verify architecture package builds
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Add architecture SVG icons to the editor
  - [~] 4.1 Create 8 architecture icon components in `apps/editor/src/components/editor-shell/CreationToolBar.tsx`
    - Add `WallIcon`, `SlabIcon`, `CeilingIcon`, `RoofIcon`, `ZoneIcon`, `ItemIcon`, `GuideIcon`, `ScanIcon` as functional React components
    - Each accepts `{ className?: string }`, renders `<svg>` with `viewBox="0 0 24 24"`, uses `currentColor` stroke
    - Follow the same pattern as `BlockoutPlatformIcon`, `RoomShellIcon`, etc.
    - _Requirements: 14.1, 14.2, 14.3_

- [ ] 5. Integrate Architecture group into CreationToolBar
  - [~] 5.1 Add `onPlaceArchitectureElement` callback prop to `CreationToolBar`
    - Add `onPlaceArchitectureElement?: (type: ArchitectureElementType) => void` to the component props
    - Import `ArchitectureElementType` from `@blud/shared`
    - _Requirements: 2.1, 2.2_

  - [~] 5.2 Render the "Architecture" `CreationGroup` in `CreationToolBar`
    - Add a `<CreationGroup label="Architecture">` block after the "Blockout" group
    - Add 8 `<CreationButton>` entries — one for each `ArchitectureElementType` value — using the new icon components
    - Each button invokes `onPlaceArchitectureElement?.()` with the corresponding type string
    - Respect the `disabled` prop on all buttons
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [~] 5.3 Thread `onPlaceArchitectureElement` through `ToolPalette` and `EditorShell`
    - Add `onPlaceArchitectureElement` to `ToolPaletteProps` in `ToolPalette.tsx`
    - Pass it through to `CreationToolBar` in the `ToolPalette` render
    - Add `onPlaceArchitectureElement` to `EditorShell` props and pass it to `ToolPalette`/`ToolsPanel`
    - _Requirements: 2.1, 2.2_

- [ ] 6. Implement architecture element placement flow in `App.tsx`
  - [~] 6.1 Create `handlePlaceArchitectureElement` handler in `App.tsx`
    - Follow the `handlePlaceSkateparkElement` pattern
    - Register missing architecture default materials in the scene's material list
    - Resolve placement position using `resolveActiveViewportState`, snap to grid
    - Build geometry via the appropriate builder function with default dimensions (Wall: 4×3×0.2, Slab: 4×4×0.2, Ceiling: 4×4×0.15 at height 3, Roof: 4×4 pitch 30° overhang 0.3, Item door: 1×2.1)
    - Create `MeshNode` for geometry elements (Wall, Slab, Ceiling, Roof, Item) with the built `EditableMesh`
    - Assign default name `"Architecture: {ElementType}"`
    - Add creation to `CommandStack` for undo/redo
    - Select the newly created node
    - _Requirements: 11.2, 12.1, 12.2, 12.3, 12.4, 13.1_

  - [~] 6.2 Handle Zone element placement
    - Create a `GroupNode` with metadata `zone.name` (default: "Zone") and `zone.usage` (default: "general")
    - Assign default name `"Architecture: Zone"`
    - Add to `CommandStack` and select
    - _Requirements: 7.1, 12.2, 12.3, 12.4_

  - [~] 6.3 Handle Guide element placement
    - Create a `GroupNode` with metadata `guide.axis` (default: "y"), `guide.offset` (default: 0), `guide.color` (default: "#FF6B6B")
    - Assign default name `"Architecture: Guide"`
    - Add to `CommandStack` and select
    - _Requirements: 9.1, 12.2, 12.3, 12.4_

  - [~] 6.4 Handle Scan element placement
    - Open a file picker dialog accepting `.glb`, `.gltf`, and `.ply` formats when the Scan button is clicked
    - Create a `ModelNode` referencing the imported asset with metadata `scan.reference: true`
    - Assign default name `"Architecture: Scan"`
    - Add to `CommandStack` and select
    - _Requirements: 10.1, 10.2, 12.2, 12.3, 12.4_

  - [~] 6.5 Wire `handlePlaceArchitectureElement` to `EditorShell`
    - Pass the handler as `onPlaceArchitectureElement` prop to `EditorShell`
    - _Requirements: 2.2, 12.1_

- [ ] 7. Checkpoint — Verify toolbar integration and placement flow
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement non-geometry element rendering and metadata
  - [~] 8.1 Implement Zone wireframe rendering
    - Render a wireframe bounding box at the zone's transform position/scale using semi-transparent blue (`#3B82F680`)
    - Do not generate solid geometry
    - _Requirements: 7.2, 7.4_

  - [~] 8.2 Implement Zone inspector fields
    - When a Zone `GroupNode` is selected, display editable fields for `zone.name` and `zone.usage` in the Inspector panel
    - _Requirements: 7.3_

  - [~] 8.3 Implement Guide line rendering
    - Render an infinite-length dashed line along the specified axis at the specified offset
    - Use the color from `guide.color` metadata
    - Do not generate solid geometry
    - _Requirements: 9.2, 9.3_

  - [~] 8.4 Implement Scan overlay rendering
    - Render scan geometry at 50% opacity to distinguish from authored geometry
    - _Requirements: 10.3_

  - [~] 8.5 Implement Item `attachTo` metadata and surface alignment
    - Store optional `attachTo` NodeID in item node metadata referencing parent wall/ceiling
    - Position the item flush against the referenced surface when `attachTo` is set
    - _Requirements: 8.4, 8.5_

- [ ] 9. Implement export exclusion for Guide and Scan elements
  - [~] 9.1 Add metadata-based export exclusion logic
    - In the scene exporter, check for `guide.*` and `scan.reference` metadata keys
    - Exclude matching nodes from exported geometry
    - _Requirements: 9.4, 10.4_

- [ ] 10. Ensure scene serialization round-trip for architecture elements
  - [~] 10.1 Verify architecture `MeshNode` serialization
    - Confirm Wall, Slab, Ceiling, Roof, and Item elements serialize to `.whmap` format using the existing `MeshNode` serialization path
    - Confirm loaded scenes reconstruct architecture `MeshNode` entries and render geometry in the viewport
    - _Requirements: 13.2, 13.3, 13.4_

  - [~] 10.2 Verify transform gizmos on architecture nodes
    - Confirm translate, rotate, and scale gizmos display correctly when architecture `MeshNode` entries are selected
    - _Requirements: 13.2_

  - [ ]* 10.3 Write integration tests for architecture element placement and serialization
    - Test placing each architecture element type and verifying the resulting scene graph node
    - Test save/load round-trip for scenes containing architecture elements
    - Test export exclusion of Guide and Scan elements
    - _Requirements: 12.1–12.4, 13.1–13.4, 9.4, 10.4_

- [ ] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The implementation language is TypeScript, matching the existing codebase
- The `@blud/architecture` package mirrors the `@blud/skatepark` package structure exactly
- Geometry builders are pure functions with no editor dependency, making them independently testable
- Non-geometry elements (Zone, Guide, Scan) use existing node kinds with metadata conventions to avoid scene graph schema changes
- Checkpoints ensure incremental validation at key integration points
