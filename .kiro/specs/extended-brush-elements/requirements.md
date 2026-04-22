# Requirements Document — Extended Brush Elements (Architecture Category)

## Introduction

This feature adds a new "Architecture" creation category to the BLUD world editor's CreationToolBar, inspired by the Pascal 3D architectural editor. The category introduces building-focused brush creation elements — Wall, Slab, Ceiling, Roof, Zone, Item, Guide, and Scan — that integrate with the existing tool system, shared scene types, geometry kernel, and material system. These elements follow the same placement flow and scene graph patterns established by existing categories such as Skatepark and Blockout.

## Glossary

- **CreationToolBar**: The toolbar component in the editor shell that groups creation tools by category (Brush, Props, Skatepark, Models, Entities, Lights, Blockout) and renders clickable buttons for each element.
- **Architecture_Category**: The new creation group added to the CreationToolBar containing building-focused elements.
- **ArchitectureElementType**: A TypeScript union type in `@blud/shared` that enumerates all architecture element identifiers: `"wall"`, `"slab"`, `"ceiling"`, `"roof"`, `"zone"`, `"item"`, `"guide"`, `"scan"`.
- **Architecture_Package**: A new `packages/architecture` package that exports geometry builder functions and default materials for architecture elements, following the same pattern as `packages/skatepark`.
- **Wall_Element**: A vertical wall segment with configurable height, thickness, and length, represented as an EditableMesh node in the scene graph.
- **Slab_Element**: A horizontal floor slab with configurable width, depth, and thickness, represented as an EditableMesh node.
- **Ceiling_Element**: A horizontal ceiling element with configurable width, depth, and thickness, represented as an EditableMesh node.
- **Roof_Element**: A roof geometry element supporting pitched and flat profiles with configurable width, depth, pitch angle, and overhang, represented as an EditableMesh node.
- **Zone_Element**: A spatial volume for defining rooms or areas, represented as a non-rendered wireframe bounding box in the scene graph with metadata for area name and usage classification.
- **Item_Element**: A placeable architectural item (door, window, light fixture) that attaches to a parent Wall_Element or Ceiling_Element, represented as a model or mesh node with an attachment reference.
- **Guide_Element**: A 2D reference guide for alignment, rendered as a non-geometry overlay line in the viewport with configurable axis and offset.
- **Scan_Element**: A 3D reference scan imported from a point cloud or mesh file, rendered as a semi-transparent overlay in the viewport for tracing and alignment.
- **EditableMesh**: The half-edge polygon mesh type defined in `@blud/shared` used to represent editable geometry in the scene graph.
- **Geometry_Builder**: A pure function in the Architecture_Package that accepts dimension parameters and returns an EditableMesh, following the pattern of `buildQuarterPipe` in `@blud/skatepark`.
- **Placement_Flow**: The existing editor interaction pattern where clicking a creation button activates a placement mode, the user clicks in the viewport to position the element, and the element is committed to the scene graph via the CommandStack.
- **Scene_Graph**: The tree of GeometryNode objects (brush, mesh, model, group, primitive, instancing, light) that represents the editable scene in `@blud/shared`.
- **CommandStack**: The undo/redo system through which all scene mutations are performed.
- **Tool_System**: The xstate-based tool state machine in `@blud/tool-system` that manages tool activation, hover, drag, commit, and cancel states.

## Requirements

### Requirement 1: Architecture Element Type Definition

**User Story:** As a developer, I want a shared type that enumerates all architecture element kinds, so that the type system enforces valid element identifiers across packages.

#### Acceptance Criteria

1. THE Architecture_Package SHALL export an `ArchitectureElementType` union type from `@blud/shared` containing the string literals `"wall"`, `"slab"`, `"ceiling"`, `"roof"`, `"zone"`, `"item"`, `"guide"`, and `"scan"`.
2. WHEN a new architecture element identifier is added to `ArchitectureElementType`, THE TypeScript compiler SHALL report type errors in all switch/map expressions that do not handle the new identifier.

### Requirement 2: Architecture Category in CreationToolBar

**User Story:** As a level designer, I want an "Architecture" group in the creation toolbar, so that I can access building-focused elements alongside existing categories.

#### Acceptance Criteria

1. THE CreationToolBar SHALL render a CreationGroup labeled "Architecture" containing one CreationButton for each ArchitectureElementType value.
2. WHEN the user clicks an Architecture CreationButton, THE CreationToolBar SHALL invoke the `onPlaceArchitectureElement` callback with the corresponding ArchitectureElementType value.
3. THE Architecture CreationGroup SHALL appear in the CreationToolBar between the "Blockout" group and any future groups, maintaining visual consistency with existing groups.
4. WHEN the editor is in a disabled state, THE Architecture CreationButtons SHALL appear visually disabled and SHALL NOT invoke callbacks on click.

### Requirement 3: Wall Element Geometry Builder

**User Story:** As a level designer, I want to place wall segments with configurable dimensions, so that I can construct building interiors and exteriors.

#### Acceptance Criteria

1. THE Architecture_Package SHALL export a `buildWall` function that accepts `width`, `height`, `thickness`, and an optional `materialId` parameter and returns an EditableMesh.
2. WHEN `buildWall` is called with valid positive dimensions, THE returned EditableMesh SHALL contain exactly 6 faces forming a closed rectangular solid with the specified width, height, and thickness.
3. WHEN `buildWall` is called, THE returned EditableMesh SHALL be centered on the local origin along the width axis, with the base at y=0 and the wall extending upward along the positive y-axis.
4. IF `buildWall` receives a zero or negative dimension value, THEN THE Architecture_Package SHALL return an EditableMesh with default minimum dimensions of 0.1 units for each axis.

### Requirement 4: Slab Element Geometry Builder

**User Story:** As a level designer, I want to place horizontal floor slabs, so that I can define walkable surfaces and floor planes.

#### Acceptance Criteria

1. THE Architecture_Package SHALL export a `buildSlab` function that accepts `width`, `depth`, `thickness`, and an optional `materialId` parameter and returns an EditableMesh.
2. WHEN `buildSlab` is called with valid positive dimensions, THE returned EditableMesh SHALL contain exactly 6 faces forming a closed rectangular solid oriented horizontally with the top face at y=0.
3. IF `buildSlab` receives a zero or negative dimension value, THEN THE Architecture_Package SHALL return an EditableMesh with default minimum dimensions of 0.1 units for each axis.

### Requirement 5: Ceiling Element Geometry Builder

**User Story:** As a level designer, I want to place ceiling elements, so that I can enclose rooms from above.

#### Acceptance Criteria

1. THE Architecture_Package SHALL export a `buildCeiling` function that accepts `width`, `depth`, `thickness`, `height` (vertical offset from ground), and an optional `materialId` parameter and returns an EditableMesh.
2. WHEN `buildCeiling` is called with valid positive dimensions, THE returned EditableMesh SHALL contain exactly 6 faces forming a closed rectangular solid oriented horizontally with the bottom face at the specified height offset.
3. IF `buildCeiling` receives a zero or negative dimension value for width, depth, or thickness, THEN THE Architecture_Package SHALL return an EditableMesh with default minimum dimensions of 0.1 units for each axis.

### Requirement 6: Roof Element Geometry Builder

**User Story:** As a level designer, I want to place roof geometry with different profiles, so that I can create realistic building tops.

#### Acceptance Criteria

1. THE Architecture_Package SHALL export a `buildRoof` function that accepts `width`, `depth`, `pitchAngle` (in degrees, 0 for flat), `overhang`, and an optional `materialId` parameter and returns an EditableMesh.
2. WHEN `buildRoof` is called with a `pitchAngle` of 0, THE returned EditableMesh SHALL represent a flat roof as a horizontal slab.
3. WHEN `buildRoof` is called with a `pitchAngle` greater than 0 and less than or equal to 89, THE returned EditableMesh SHALL represent a pitched (gabled) roof with two sloped faces meeting at a ridge line along the depth axis.
4. WHEN `buildRoof` is called with an `overhang` greater than 0, THE returned EditableMesh SHALL extend beyond the base width and depth by the overhang distance on each side.
5. IF `buildRoof` receives a `pitchAngle` outside the range 0–89, THEN THE Architecture_Package SHALL clamp the value to the nearest valid bound.

### Requirement 7: Zone Element

**User Story:** As a level designer, I want to define spatial zones that represent rooms or areas, so that I can organize the level into named regions for gameplay logic.

#### Acceptance Criteria

1. THE Editor SHALL represent a Zone_Element as a GeometryNode of kind `"group"` with metadata fields `zone.name` (string) and `zone.usage` (string) stored in the node's `metadata` property.
2. WHEN a Zone_Element is placed, THE Editor SHALL render a wireframe bounding box in the viewport at the zone's transform position and scale, without generating solid geometry.
3. WHEN a Zone_Element is selected, THE Inspector panel SHALL display editable fields for `zone.name` and `zone.usage`.
4. THE Zone_Element wireframe SHALL use a distinct color (semi-transparent blue) to differentiate zones from solid geometry.

### Requirement 8: Item Element

**User Story:** As a level designer, I want to place architectural items like doors, windows, and light fixtures that attach to walls or ceilings, so that I can detail building interiors.

#### Acceptance Criteria

1. THE Architecture_Package SHALL export a `buildItem` function that accepts `itemType` (one of `"door"`, `"window"`, `"light-fixture"`), `width`, `height`, and an optional `materialId` parameter and returns an EditableMesh.
2. WHEN a door Item_Element is built, THE returned EditableMesh SHALL represent a rectangular opening frame with the specified width and height.
3. WHEN a window Item_Element is built, THE returned EditableMesh SHALL represent a rectangular frame with the specified width and height, offset vertically to a default sill height of 0.9 units.
4. WHEN an Item_Element is placed in the scene, THE Editor SHALL store an optional `attachTo` NodeID in the node's metadata, referencing the parent Wall_Element or Ceiling_Element.
5. WHILE an Item_Element has a valid `attachTo` reference, THE Editor SHALL position the Item_Element flush against the referenced surface.

### Requirement 9: Guide Element

**User Story:** As a level designer, I want to place 2D reference guides for alignment, so that I can align architecture elements precisely.

#### Acceptance Criteria

1. THE Editor SHALL represent a Guide_Element as a GeometryNode of kind `"group"` with metadata fields `guide.axis` (one of `"x"`, `"y"`, `"z"`) and `guide.offset` (number) stored in the node's `metadata` property.
2. WHEN a Guide_Element is placed, THE Editor SHALL render an infinite-length line in the viewport along the specified axis at the specified offset, without generating solid geometry.
3. THE Guide_Element line SHALL use a distinct dashed style with a configurable color stored in `guide.color` metadata.
4. WHEN the scene is exported, THE Exporter SHALL exclude Guide_Element nodes from the exported geometry.

### Requirement 10: Scan Element

**User Story:** As a level designer, I want to import 3D reference scans, so that I can trace real-world geometry in the editor.

#### Acceptance Criteria

1. WHEN the user clicks the Scan CreationButton, THE Editor SHALL open a file picker dialog accepting `.glb`, `.gltf`, and `.ply` file formats.
2. WHEN a valid scan file is loaded, THE Editor SHALL create a ModelNode in the scene graph referencing the imported asset with metadata field `scan.reference` set to `true`.
3. WHILE a Scan_Element is present in the scene, THE Editor SHALL render the scan geometry with 50% opacity to visually distinguish the scan from authored geometry.
4. WHEN the scene is exported, THE Exporter SHALL exclude Scan_Element nodes (nodes with `scan.reference` metadata set to `true`) from the exported geometry.

### Requirement 11: Architecture Default Materials

**User Story:** As a level designer, I want architecture elements to have sensible default materials, so that placed elements are visually distinguishable without manual material assignment.

#### Acceptance Criteria

1. THE Architecture_Package SHALL export a `architectureMaterials` object containing default Material definitions for each architecture element type: wall, slab, ceiling, and roof.
2. WHEN an architecture element is placed in the scene, THE Editor SHALL register any missing architecture default materials in the scene's material list before creating the element node.
3. THE default wall material SHALL use a light gray color (`#C8C8C8`), the default slab material SHALL use a medium gray color (`#A0A0A0`), the default ceiling material SHALL use a white color (`#E8E8E8`), and the default roof material SHALL use a terracotta color (`#B86F50`).

### Requirement 12: Architecture Element Placement Flow

**User Story:** As a level designer, I want architecture elements to follow the same placement interaction as existing creation tools, so that the workflow is consistent and predictable.

#### Acceptance Criteria

1. WHEN the user clicks an Architecture CreationButton, THE Editor SHALL activate a placement mode where the next viewport click positions the element on the construction grid at the snapped cursor location.
2. WHEN the user clicks in the viewport during architecture placement mode, THE Editor SHALL create the corresponding architecture element node at the clicked position and add the creation to the CommandStack for undo/redo support.
3. WHEN an architecture element is placed, THE Editor SHALL assign the element a default name following the pattern `"Architecture: {ElementType}"` (e.g., `"Architecture: Wall"`).
4. WHEN an architecture element is placed, THE Editor SHALL select the newly created node in the scene graph.

### Requirement 13: Architecture Element Scene Integration

**User Story:** As a developer, I want architecture elements to participate in the existing scene graph, so that they support selection, transformation, parenting, and serialization like all other nodes.

#### Acceptance Criteria

1. THE Editor SHALL represent Wall, Slab, Ceiling, and Roof elements as `MeshNode` entries in the Scene_Graph, using the EditableMesh data returned by the corresponding Geometry_Builder.
2. WHEN an architecture MeshNode is selected, THE Editor SHALL display translate, rotate, and scale gizmos consistent with other MeshNode selections.
3. WHEN the scene is saved to `.whmap` format, THE Editor SHALL serialize architecture element nodes using the existing MeshNode serialization path.
4. WHEN a saved scene containing architecture elements is loaded, THE Editor SHALL reconstruct the architecture MeshNode entries and render the geometry in the viewport.

### Requirement 14: Architecture Toolbar Icons

**User Story:** As a level designer, I want each architecture element to have a distinct icon in the toolbar, so that I can quickly identify and select the element I need.

#### Acceptance Criteria

1. THE CreationToolBar SHALL render a unique SVG icon for each ArchitectureElementType value: Wall, Slab, Ceiling, Roof, Zone, Item, Guide, and Scan.
2. THE architecture icons SHALL follow the same sizing (16×16 logical pixels via `size-4` class), stroke style, and color conventions as existing CreationToolBar icons.
3. WHEN an Architecture CreationButton is in the active state, THE icon SHALL use the active highlight color (`text-[#fff0cb]`) consistent with other active creation buttons.
