# Requirements Document — Worldbuilding Tools

## Introduction

This feature adds four major worldbuilding tool categories to the BLUD world editor (`apps/editor`): Terrain, Foliage/Scatter, Tile/Grid (GridMap), and Advanced Splines. These tools address the largest missing category of functionality for open-world and environment authoring, inspired by workflows from Blender, Godot, Unity, and Unreal Engine. Each tool category integrates with the existing xstate-based tool system (`@blud/tool-system`), the CommandStack undo/redo system (`@blud/editor-core`), the scene graph node types (`@blud/shared`), and the AI copilot tool declaration system.

## Glossary

- **Terrain_Tool**: The editor tool for sculpting heightmap-based terrain geometry using configurable brushes and painting texture splatmaps.
- **Terrain_Node**: A new scene graph node kind (`"terrain"`) representing a heightmap-based terrain chunk with associated splatmap and LOD data.
- **Heightmap**: A 2D grid of elevation values that defines the vertical displacement of terrain vertices.
- **Splatmap**: A multi-channel texture that stores per-texel blend weights for terrain surface layers (grass, rock, dirt, etc.).
- **Terrain_Brush**: A circular or square influence region used to modify heightmap values during sculpting operations (raise, lower, flatten, smooth, noise, terrace, erosion).
- **Terrain_Spline**: A spline path that deforms the underlying terrain surface to create roads, rivers, or other linear features carved into the terrain.
- **Foliage_Tool**: The editor tool for painting and erasing foliage instances (grass, rocks, trees, props, decals, detail meshes) onto terrain and mesh surfaces.
- **Foliage_Instance**: A single placed occurrence of a foliage type, stored as a transform (position, rotation, scale) referencing a foliage palette entry.
- **Foliage_Palette**: A collection of foliage type definitions, each specifying a mesh reference, scale range, density, rotation range, and placement rules.
- **GPU_Instancing**: A rendering technique that draws many copies of the same mesh in a single draw call using per-instance transform buffers.
- **GridMap_Tool**: The editor tool for snapping modular kit pieces onto a configurable 3D grid, similar to Godot's GridMap workflow. Registered with tool ID `"gridmap"`.
- **GridMap_Node**: A new scene graph node kind (`"gridmap"`) representing a 3D grid of tile references with associated cell size and tile palette.
- **Tile_Palette**: A collection of tile definitions, each referencing a mesh/model asset with optional collision and navigation mesh data.
- **Spline_System**: The advanced spline authoring system that extends the existing `ScenePathDefinition` in `@blud/shared` with typed splines, cross-section profiles, and terrain integration.
- **Spline_Node**: A new scene graph node kind (`"spline"`) representing a typed spline with control points, tangent handles, cross-section profile, and mesh generation data.
- **Cross_Section_Profile**: A 2D polyline that defines the shape extruded along a spline path to generate mesh geometry (e.g., road surface, pipe cross-section, fence profile).
- **Control_Point**: A point on a spline with position, in-tangent, and out-tangent vectors that define the curve shape. Supports Bezier and Catmull-Rom interpolation modes.
- **CommandStack**: The undo/redo system in `@blud/editor-core` through which all scene mutations are performed.
- **Tool_System**: The xstate-based tool state machine in `@blud/tool-system` that manages tool activation, hover, drag, commit, and cancel states.
- **Scene_Graph**: The tree of `GeometryNode` objects that represents the editable scene in `@blud/shared`.
- **CreationToolBar**: The toolbar component in the editor shell that groups creation tools by category.
- **Copilot_Tool_Declaration**: A tool definition in `apps/editor/src/lib/copilot/tool-declarations.ts` that exposes editor functionality to the AI copilot.
- **LOD**: Level of Detail — a rendering optimization that reduces geometric complexity for distant terrain chunks.
- **Nav_Mesh**: Navigation mesh data baked into tiles for AI pathfinding.

## Requirements


### Requirement 1: Terrain Node Type

**User Story:** As a developer, I want a dedicated terrain node kind in the scene graph, so that terrain data (heightmap, splatmap, LOD settings) has a well-defined schema separate from generic mesh nodes.

#### Acceptance Criteria

1. THE Scene_Graph SHALL include a `TerrainNode` type with kind `"terrain"` containing a `TerrainNodeData` payload with fields for `heightmap` (2D Float32Array grid), `resolution` (integer grid dimensions), `size` (Vec3 world extents), `splatmap` (multi-channel blend weight grid), `layers` (array of terrain layer definitions with material references), and `lodLevels` (integer count of LOD tiers).
2. WHEN a TerrainNode is added to the scene, THE Editor SHALL render the terrain as a subdivided mesh derived from the heightmap data at the node's transform position.
3. WHEN the scene is saved to `.whmap` format, THE Editor SHALL serialize TerrainNode data including the heightmap, splatmap, layer definitions, and LOD settings.
4. WHEN a saved scene containing a TerrainNode is loaded, THE Editor SHALL reconstruct the terrain mesh from the serialized heightmap data and render the terrain in the viewport.

### Requirement 2: Terrain Sculpting Brushes

**User Story:** As a level designer, I want to sculpt terrain with configurable brushes, so that I can shape landscapes with raise, lower, flatten, smooth, noise, terrace, and erosion operations.

#### Acceptance Criteria

1. THE Terrain_Tool SHALL provide sculpting brush modes: `raise`, `lower`, `flatten`, `smooth`, `noise`, `terrace`, and `erosion`.
2. WHEN the user selects a sculpting brush mode and drags on a Terrain_Node surface, THE Terrain_Tool SHALL modify the heightmap values within the brush radius according to the selected mode and brush strength.
3. THE Terrain_Tool SHALL expose configurable brush parameters: `radius` (world units), `strength` (0.0 to 1.0), and `falloff` (linear, smooth, or constant).
4. WHEN the `raise` brush is applied, THE Terrain_Tool SHALL increase heightmap values within the brush radius proportional to the brush strength and falloff curve.
5. WHEN the `lower` brush is applied, THE Terrain_Tool SHALL decrease heightmap values within the brush radius proportional to the brush strength and falloff curve.
6. WHEN the `flatten` brush is applied, THE Terrain_Tool SHALL set heightmap values within the brush radius toward the height value sampled at the brush center on first click.
7. WHEN the `smooth` brush is applied, THE Terrain_Tool SHALL average neighboring heightmap values within the brush radius to reduce sharp elevation changes.
8. WHEN the `noise` brush is applied, THE Terrain_Tool SHALL add procedural noise displacement to heightmap values within the brush radius, scaled by brush strength.
9. WHEN the `terrace` brush is applied, THE Terrain_Tool SHALL quantize heightmap values within the brush radius to discrete elevation steps with a configurable step height.
10. WHEN the `erosion` brush is applied, THE Terrain_Tool SHALL simulate hydraulic erosion on heightmap values within the brush radius, smoothing peaks and deepening valleys.
11. WHEN a sculpting operation completes (mouse up), THE Terrain_Tool SHALL push the heightmap modification to the CommandStack as a single undoable command.

### Requirement 3: Terrain Layer Painting

**User Story:** As a level designer, I want to paint terrain surface layers with blend weights, so that I can texture terrain with grass, rock, dirt, and other materials.

#### Acceptance Criteria

1. THE Terrain_Tool SHALL provide a layer painting mode that modifies splatmap blend weights for a selected terrain layer.
2. WHEN the user selects a terrain layer and paints on a Terrain_Node surface, THE Terrain_Tool SHALL increase the splatmap blend weight for the selected layer within the brush radius while proportionally decreasing weights for other layers so that per-texel weights sum to 1.0.
3. THE Terrain_Tool SHALL support a configurable layer palette where each layer references a Material from the scene's material list.
4. WHEN a layer painting operation completes (mouse up), THE Terrain_Tool SHALL push the splatmap modification to the CommandStack as a single undoable command.
5. THE Renderer SHALL blend terrain layer materials in the viewport according to the splatmap weights, displaying the painted surface in real time during editing.

### Requirement 4: Terrain Hole Cutouts

**User Story:** As a level designer, I want to cut holes in terrain, so that I can create cave entrances, tunnels, and other openings in the terrain surface.

#### Acceptance Criteria

1. THE Terrain_Tool SHALL provide a `hole` brush mode that marks terrain cells as invisible.
2. WHEN the `hole` brush is applied to a Terrain_Node, THE Terrain_Tool SHALL set a per-cell visibility flag to `false` for cells within the brush radius.
3. WHEN terrain cells are marked as holes, THE Renderer SHALL exclude those cells from the rendered terrain mesh, creating visible openings.
4. THE Terrain_Tool SHALL provide an `un-hole` brush mode that restores visibility to previously cut cells.
5. WHEN a hole cutout operation completes (mouse up), THE Terrain_Tool SHALL push the visibility modification to the CommandStack as a single undoable command.

### Requirement 5: Terrain Splines

**User Story:** As a level designer, I want to place splines that deform the terrain surface, so that I can create roads and rivers that carve into or flatten the terrain.

#### Acceptance Criteria

1. THE Terrain_Tool SHALL support Terrain_Spline placement, where a spline path is associated with a Terrain_Node and defines a deformation corridor.
2. WHEN a Terrain_Spline is placed on a Terrain_Node, THE Terrain_Tool SHALL flatten the heightmap values along the spline path within a configurable corridor width.
3. THE Terrain_Spline SHALL expose configurable parameters: `width` (corridor width in world units), `falloff` (distance over which terrain blends from spline elevation to original elevation), and `embedDepth` (vertical offset below the spline for river-style carving).
4. WHEN a Terrain_Spline's control points are moved, THE Terrain_Tool SHALL recompute the terrain deformation along the updated path.
5. WHEN a Terrain_Spline is deleted, THE Terrain_Tool SHALL restore the heightmap values to their pre-deformation state within the spline's corridor.
6. WHEN a Terrain_Spline operation completes, THE Terrain_Tool SHALL push the deformation to the CommandStack as a single undoable command.

### Requirement 6: Terrain LOD

**User Story:** As a developer, I want terrain to support level-of-detail rendering, so that large terrains remain performant by reducing geometric complexity for distant chunks.

#### Acceptance Criteria

1. THE Renderer SHALL subdivide each Terrain_Node into chunks and generate multiple LOD meshes per chunk with progressively reduced vertex counts.
2. WHEN the editor camera moves, THE Renderer SHALL select the appropriate LOD level for each terrain chunk based on the distance from the camera to the chunk center.
3. THE TerrainNodeData SHALL store a `lodLevels` field (integer, default 4) that controls how many LOD tiers are generated.
4. WHEN LOD transitions occur, THE Renderer SHALL blend between adjacent LOD levels to avoid visible popping artifacts.

### Requirement 7: Terrain Tool Registration

**User Story:** As a developer, I want the terrain tool registered in the tool system, so that it follows the same xstate-based activation pattern as existing tools.

#### Acceptance Criteria

1. THE Tool_System SHALL include `"terrain"` in the `ToolId` union type.
2. THE tool registry SHALL include an entry `{ id: "terrain", label: "Terrain" }` in the `defaultTools` array.
3. WHEN the terrain tool is activated, THE Tool_System SHALL create a tool session with an xstate machine supporting states: `idle`, `sculpt`, `paint`, `hole`, and `spline`, with transitions driven by mode selection and pointer events.
4. THE ToolPalette SHALL render terrain-specific controls (brush mode selector, brush radius slider, brush strength slider, layer palette) when the terrain tool is active.


### Requirement 8: Foliage Palette Definition

**User Story:** As a level designer, I want to define foliage types in a palette, so that I can configure mesh references, scale ranges, density, and placement rules before painting.

#### Acceptance Criteria

1. THE Foliage_Palette SHALL store an array of foliage type entries, each containing: `id` (string), `name` (string), `meshAssetId` (AssetID referencing a model asset), `minScale` (number, default 0.8), `maxScale` (number, default 1.2), `density` (instances per square unit, default 1.0), `alignToNormal` (boolean, default true), `randomRotationY` (boolean, default true), and `minSlopeAngle`/`maxSlopeAngle` (degrees, defining valid placement slope range).
2. THE Editor SHALL persist the Foliage_Palette as part of the scene settings in the `.whmap` file.
3. WHEN a foliage type entry is added or modified in the palette, THE Editor SHALL validate that the referenced `meshAssetId` exists in the scene's asset list.
4. IF a foliage type references a missing asset, THEN THE Editor SHALL display a warning indicator next to the palette entry.

### Requirement 9: Foliage Paint-to-Place Mode

**User Story:** As a level designer, I want to paint foliage instances onto surfaces by dragging, so that I can quickly populate terrain and meshes with grass, rocks, trees, and props.

#### Acceptance Criteria

1. THE Foliage_Tool SHALL provide a paint mode where dragging on a surface places Foliage_Instance entries according to the selected foliage type's density, scale range, and rotation settings.
2. WHEN the user paints on a Terrain_Node surface, THE Foliage_Tool SHALL raycast against the terrain heightmap to determine placement positions and surface normals.
3. WHEN the user paints on a MeshNode or PrimitiveNode surface, THE Foliage_Tool SHALL raycast against the mesh geometry to determine placement positions and surface normals.
4. WHEN `alignToNormal` is true for the selected foliage type, THE Foliage_Tool SHALL orient each placed instance so that its up vector aligns with the surface normal at the placement point.
5. WHEN `randomRotationY` is true for the selected foliage type, THE Foliage_Tool SHALL apply a random rotation around the instance's local Y axis (0 to 360 degrees) to each placed instance.
6. THE Foliage_Tool SHALL randomize each instance's scale uniformly between the foliage type's `minScale` and `maxScale` values.
7. WHEN a paint stroke completes (mouse up), THE Foliage_Tool SHALL push all placed instances to the CommandStack as a single undoable command.

### Requirement 10: Foliage Erase Mode

**User Story:** As a level designer, I want to erase placed foliage instances by painting, so that I can remove unwanted vegetation and props from surfaces.

#### Acceptance Criteria

1. THE Foliage_Tool SHALL provide an erase mode where dragging on a surface removes Foliage_Instance entries within the brush radius.
2. WHEN the erase brush is applied, THE Foliage_Tool SHALL remove all foliage instances whose positions fall within the brush radius of the cursor, regardless of foliage type.
3. WHEN an erase stroke completes (mouse up), THE Foliage_Tool SHALL push all removed instances to the CommandStack as a single undoable command, allowing undo to restore the erased instances.

### Requirement 11: Foliage GPU Instancing

**User Story:** As a developer, I want foliage instances to use GPU instancing for rendering, so that scenes with thousands of foliage instances maintain acceptable frame rates.

#### Acceptance Criteria

1. THE Renderer SHALL group Foliage_Instance entries by their foliage type's mesh asset and render each group using GPU_Instancing with a single draw call per mesh type.
2. THE Renderer SHALL upload per-instance transform data (position, rotation, scale) to a GPU instance buffer and update the buffer when instances are added or removed.
3. WHEN the total foliage instance count exceeds 10,000 in a scene, THE Renderer SHALL maintain a frame rate above 30 FPS in the editor viewport on a mid-range GPU (equivalent to NVIDIA GTX 1660 or Apple M1).
4. THE Renderer SHALL frustum-cull foliage instance groups so that off-screen instances do not consume draw calls.

### Requirement 12: Foliage Tool Registration

**User Story:** As a developer, I want the foliage tool registered in the tool system, so that it follows the same activation pattern as existing tools.

#### Acceptance Criteria

1. THE Tool_System SHALL include `"foliage"` in the `ToolId` union type.
2. THE tool registry SHALL include an entry `{ id: "foliage", label: "Foliage" }` in the `defaultTools` array.
3. WHEN the foliage tool is activated, THE Tool_System SHALL create a tool session with an xstate machine supporting states: `idle`, `paint`, and `erase`, with transitions driven by mode selection and pointer events.
4. THE ToolPalette SHALL render foliage-specific controls (foliage palette selector, brush radius slider, density override slider, paint/erase mode toggle) when the foliage tool is active.

### Requirement 13: GridMap Node Type

**User Story:** As a developer, I want a dedicated gridmap node kind in the scene graph, so that tile grid data has a well-defined schema for serialization and rendering.

#### Acceptance Criteria

1. THE Scene_Graph SHALL include a `GridMapNode` type with kind `"gridmap"` containing a `GridMapNodeData` payload with fields for `cellSize` (Vec3 defining the 3D grid cell dimensions), `tiles` (a sparse map from grid coordinates `{x, y, z}` to tile entries containing `tileId`, `rotation` (0, 90, 180, or 270 degrees), and optional `flipX`/`flipZ` booleans), and `palette` (array of Tile_Palette entries).
2. WHEN a GridMapNode is added to the scene, THE Editor SHALL render a 3D grid overlay at the node's transform position with cell boundaries matching the configured `cellSize`.
3. WHEN the scene is saved to `.whmap` format, THE Editor SHALL serialize GridMapNode data including the sparse tile map, cell size, and tile palette.
4. WHEN a saved scene containing a GridMapNode is loaded, THE Editor SHALL reconstruct the tile grid and render all placed tiles in the viewport.

### Requirement 14: Tile Palette Definition

**User Story:** As a level designer, I want to define tile types in a palette, so that I can configure which mesh assets are available for grid placement.

#### Acceptance Criteria

1. THE Tile_Palette SHALL store an array of tile type entries, each containing: `id` (string), `name` (string), `meshAssetId` (AssetID referencing a model asset), `hasCollision` (boolean, default true), and `hasNavMesh` (boolean, default false).
2. WHEN a tile type entry is added or modified in the palette, THE Editor SHALL validate that the referenced `meshAssetId` exists in the scene's asset list.
3. IF a tile type references a missing asset, THEN THE Editor SHALL display a warning indicator next to the palette entry.
4. THE Editor SHALL persist the Tile_Palette as part of the GridMapNode data in the `.whmap` file.

### Requirement 15: GridMap Paint and Erase

**User Story:** As a level designer, I want to paint and erase tiles on the grid by clicking and dragging, so that I can rapidly build modular environments.

#### Acceptance Criteria

1. WHEN the GridMap_Tool is active and the user clicks or drags on the grid, THE GridMap_Tool SHALL place the selected tile from the Tile_Palette at the snapped grid cell position.
2. WHEN a tile is placed, THE GridMap_Tool SHALL render the tile's referenced mesh asset at the grid cell position, scaled to fit the cell size.
3. THE GridMap_Tool SHALL provide an erase mode where clicking or dragging on occupied grid cells removes the tile entry.
4. WHEN a tile is placed in a cell that already contains a tile, THE GridMap_Tool SHALL replace the existing tile with the newly selected tile.
5. WHEN a paint or erase operation completes (mouse up), THE GridMap_Tool SHALL push the tile modifications to the CommandStack as a single undoable command.

### Requirement 16: GridMap Auto-Rotation and Auto-Tiling

**User Story:** As a level designer, I want optional auto-rotation and auto-tiling rules, so that tiles automatically orient based on their neighbors for seamless modular assembly.

#### Acceptance Criteria

1. WHERE auto-tiling is enabled for a GridMapNode, THE GridMap_Tool SHALL evaluate neighbor adjacency when a tile is placed and select the appropriate tile variant and rotation from the palette based on configurable adjacency rules.
2. THE Tile_Palette entry SHALL support an optional `autoTileRules` field containing adjacency match patterns that map neighbor configurations to tile variant IDs and rotation values.
3. WHEN a tile is placed or removed and auto-tiling is enabled, THE GridMap_Tool SHALL re-evaluate and update adjacent tiles that reference auto-tile rules.
4. WHERE auto-tiling is disabled (default), THE GridMap_Tool SHALL place tiles with the user's explicitly selected rotation without automatic adjustment.

### Requirement 17: GridMap Collision and Nav Mesh

**User Story:** As a developer, I want collision and navigation mesh data baked into grid tiles, so that placed tiles contribute to physics and AI pathfinding without manual setup.

#### Acceptance Criteria

1. WHEN a tile with `hasCollision` set to true is placed, THE Editor SHALL generate a collision shape from the tile's mesh geometry and register the collision shape with the physics system.
2. WHEN a tile with `hasNavMesh` set to true is placed, THE Editor SHALL include the tile's walkable surfaces in the scene's navigation mesh data.
3. WHEN a tile is removed from the grid, THE Editor SHALL remove the corresponding collision shape and navigation mesh contribution.

### Requirement 18: GridMap Tool Registration

**User Story:** As a developer, I want the gridmap tool registered in the tool system with tool ID `"gridmap"`, so that it follows the same activation pattern as existing tools.

#### Acceptance Criteria

1. THE Tool_System SHALL include `"gridmap"` in the `ToolId` union type.
2. THE tool registry SHALL include an entry `{ id: "gridmap", label: "GridMap" }` in the `defaultTools` array.
3. WHEN the gridmap tool is activated, THE Tool_System SHALL create a tool session with an xstate machine supporting states: `idle`, `paint`, and `erase`, with transitions driven by mode selection and pointer events.
4. THE ToolPalette SHALL render gridmap-specific controls (tile palette selector, cell size inputs, rotation controls, auto-tiling toggle, paint/erase mode toggle) when the gridmap tool is active.


### Requirement 19: Spline Node Type

**User Story:** As a developer, I want a dedicated spline node kind in the scene graph, so that typed splines with control points, tangent handles, and cross-section profiles have a well-defined schema.

#### Acceptance Criteria

1. THE Scene_Graph SHALL include a `SplineNode` type with kind `"spline"` containing a `SplineNodeData` payload with fields for `splineType` (one of `"road"`, `"fence"`, `"pipe"`, `"rail"`, `"cable"`, `"wall"`, `"river"`, `"curb"`), `interpolation` (one of `"bezier"`, `"catmull-rom"`), `controlPoints` (array of Control_Point entries with `position` Vec3, `inTangent` Vec3, and `outTangent` Vec3), `crossSection` (Cross_Section_Profile), `closed` (boolean), and `terrainIntegration` (optional object with `flatten` boolean, `corridorWidth` number, and `embedDepth` number).
2. WHEN a SplineNode is added to the scene, THE Editor SHALL render the spline curve as a visible path in the viewport with control point handles.
3. WHEN the scene is saved to `.whmap` format, THE Editor SHALL serialize SplineNode data including control points, tangent handles, cross-section profile, and terrain integration settings.
4. WHEN a saved scene containing a SplineNode is loaded, THE Editor SHALL reconstruct the spline curve and generated mesh in the viewport.

### Requirement 20: Spline Control Point Editing

**User Story:** As a level designer, I want to add, move, and delete control points with tangent handles, so that I can shape spline curves precisely.

#### Acceptance Criteria

1. WHEN the user clicks on an empty section of a spline, THE Spline_System SHALL insert a new Control_Point at the clicked position on the curve.
2. WHEN the user drags a Control_Point, THE Spline_System SHALL update the control point's position and recompute the spline curve in real time.
3. WHEN the user drags a tangent handle, THE Spline_System SHALL update the corresponding `inTangent` or `outTangent` vector and recompute the spline curve in real time.
4. WHEN the user deletes a selected Control_Point, THE Spline_System SHALL remove the point and recompute the spline curve, provided at least two control points remain.
5. WHEN a control point editing operation completes, THE Spline_System SHALL push the modification to the CommandStack as a single undoable command.
6. THE Spline_System SHALL support both Bezier (independent tangent handles) and Catmull-Rom (auto-computed tangents from neighboring points) interpolation modes, selectable per spline.

### Requirement 21: Deform-Mesh-Along-Spline

**User Story:** As a level designer, I want to extrude a cross-section profile along a spline path to generate mesh geometry, so that I can create roads, fences, pipes, rails, cables, walls, rivers, and curbs.

#### Acceptance Criteria

1. THE Spline_System SHALL generate an EditableMesh by extruding the spline's Cross_Section_Profile along the spline curve, sampling the curve at a configurable segment count.
2. WHEN the spline's control points, cross-section profile, or segment count change, THE Spline_System SHALL regenerate the extruded mesh and update the viewport in real time.
3. THE Cross_Section_Profile SHALL be defined as an array of Vec2 points representing a 2D polyline in the spline's local cross-section plane.
4. THE Spline_System SHALL provide default Cross_Section_Profile presets for each spline type: flat road surface, fence post-and-rail, circular pipe, rectangular rail, thin cable, thick wall, concave river bed, and L-shaped curb.
5. WHEN the user modifies a Cross_Section_Profile, THE Spline_System SHALL regenerate the extruded mesh and push the change to the CommandStack.

### Requirement 22: Spline-to-Terrain Integration

**User Story:** As a level designer, I want road and river splines to flatten or carve the terrain beneath them, so that spline-based features blend naturally into the landscape.

#### Acceptance Criteria

1. WHEN a SplineNode has `terrainIntegration.flatten` set to true and overlaps a Terrain_Node, THE Spline_System SHALL flatten the terrain heightmap along the spline path within the configured `corridorWidth`.
2. WHEN a SplineNode has `terrainIntegration.embedDepth` greater than zero, THE Spline_System SHALL lower the terrain heightmap along the spline path by the specified depth to create a carved channel (for rivers, trenches).
3. WHEN a SplineNode with terrain integration is moved or its control points are edited, THE Spline_System SHALL recompute the terrain deformation along the updated path.
4. WHEN a SplineNode with terrain integration is deleted, THE Spline_System SHALL restore the terrain heightmap to its pre-deformation state within the spline's corridor.
5. WHEN a terrain integration operation completes, THE Spline_System SHALL push both the spline change and the terrain deformation to the CommandStack as a single undoable command.

### Requirement 23: Spline System Integration with Existing Paths

**User Story:** As a developer, I want the advanced spline system to integrate with the existing `ScenePathDefinition` in `@blud/shared`, so that splines can be used for gameplay path movement and the existing path-add/path-edit tools remain functional.

#### Acceptance Criteria

1. THE Spline_System SHALL generate a `ScenePathDefinition` from each SplineNode by sampling the spline curve at regular intervals and storing the sampled positions in the path's `points` array.
2. WHEN a SplineNode is added or modified, THE Spline_System SHALL update the corresponding `ScenePathDefinition` in the scene settings' `paths` array.
3. WHEN a SplineNode is deleted, THE Spline_System SHALL remove the corresponding `ScenePathDefinition` from the scene settings.
4. THE existing `path-add` and `path-edit` tools SHALL continue to function for simple linear paths that do not use the advanced spline features.

### Requirement 24: Spline Tool Registration

**User Story:** As a developer, I want spline editing integrated into the tool system, so that spline creation and editing follow the same activation pattern as existing tools.

#### Acceptance Criteria

1. THE Tool_System SHALL include `"spline-add"` and `"spline-edit"` in the `ToolId` union type.
2. THE tool registry SHALL include entries `{ id: "spline-add", label: "Add Spline" }` and `{ id: "spline-edit", label: "Edit Spline" }` in the `defaultTools` array.
3. WHEN the `spline-add` tool is activated, THE Tool_System SHALL create a tool session that allows the user to place control points sequentially to define a new spline, committing the spline on double-click or Enter key.
4. WHEN the `spline-edit` tool is activated, THE Tool_System SHALL create a tool session that allows the user to select and manipulate existing spline control points and tangent handles.
5. THE ToolPalette SHALL render spline-specific controls (spline type selector, interpolation mode toggle, cross-section profile editor, terrain integration settings) when a spline tool is active.

### Requirement 25: Worldbuilding CreationToolBar Category

**User Story:** As a level designer, I want a "Worldbuilding" group in the creation toolbar, so that I can access terrain, foliage, gridmap, and spline creation tools from a single category.

#### Acceptance Criteria

1. THE CreationToolBar SHALL render a CreationGroup labeled "Worldbuilding" containing creation buttons for: Create Terrain, Create GridMap, and Create Spline (by type).
2. WHEN the user clicks the "Create Terrain" button, THE Editor SHALL create a new Terrain_Node with default dimensions and resolution at the viewport center and activate the terrain tool.
3. WHEN the user clicks the "Create GridMap" button, THE Editor SHALL create a new GridMap_Node with default cell size at the viewport center and activate the gridmap tool.
4. WHEN the user clicks a spline type button, THE Editor SHALL activate the `spline-add` tool with the selected spline type pre-configured.
5. THE Worldbuilding CreationGroup SHALL appear in the CreationToolBar after the "Architecture" group, maintaining visual consistency with existing groups.

### Requirement 26: Copilot Tool Declarations for Worldbuilding

**User Story:** As a developer, I want AI copilot tool declarations for worldbuilding operations, so that the copilot can assist with terrain creation, foliage placement, gridmap assembly, and spline authoring.

#### Acceptance Criteria

1. THE Copilot_Tool_Declaration list SHALL include a `place_terrain` tool declaration with parameters for position (x, y, z), size (sizeX, sizeY, sizeZ), resolution, and optional name.
2. THE Copilot_Tool_Declaration list SHALL include a `sculpt_terrain` tool declaration with parameters for terrain node ID, brush mode, brush position (x, z), brush radius, and brush strength.
3. THE Copilot_Tool_Declaration list SHALL include a `paint_foliage` tool declaration with parameters for surface node ID, foliage type ID, position (x, y, z), radius, and density override.
4. THE Copilot_Tool_Declaration list SHALL include a `place_gridmap` tool declaration with parameters for position (x, y, z), cell size (cellX, cellY, cellZ), and optional name.
5. THE Copilot_Tool_Declaration list SHALL include a `set_gridmap_tile` tool declaration with parameters for gridmap node ID, grid coordinates (gridX, gridY, gridZ), tile ID, and rotation.
6. THE Copilot_Tool_Declaration list SHALL include a `place_spline` tool declaration with parameters for spline type, control points array, interpolation mode, and optional terrain integration settings.
7. WHEN the copilot invokes a worldbuilding tool declaration, THE tool executor SHALL create the corresponding scene graph nodes and push the operation to the CommandStack.

### Requirement 27: Undo/Redo for All Worldbuilding Operations

**User Story:** As a level designer, I want all worldbuilding operations to support undo and redo, so that I can freely experiment with terrain sculpting, foliage painting, tile placement, and spline editing without fear of irreversible mistakes.

#### Acceptance Criteria

1. THE Terrain_Tool SHALL push every sculpting stroke, layer painting stroke, hole cutout stroke, and spline deformation to the CommandStack as individual undoable commands.
2. THE Foliage_Tool SHALL push every paint stroke and erase stroke to the CommandStack as individual undoable commands.
3. THE GridMap_Tool SHALL push every tile placement and tile removal operation to the CommandStack as individual undoable commands.
4. THE Spline_System SHALL push every control point addition, movement, deletion, cross-section change, and terrain integration change to the CommandStack as individual undoable commands.
5. WHEN the user invokes undo after a worldbuilding operation, THE CommandStack SHALL restore the affected data (heightmap, splatmap, foliage instances, tile grid, or spline control points) to the state before the operation.
6. WHEN the user invokes redo after an undo of a worldbuilding operation, THE CommandStack SHALL reapply the operation, restoring the data to the post-operation state.

### Requirement 28: Worldbuilding Package Structure

**User Story:** As a developer, I want worldbuilding functionality organized into dedicated packages, so that terrain, foliage, gridmap, and spline logic is modular and follows the existing monorepo package patterns.

#### Acceptance Criteria

1. THE monorepo SHALL contain a `packages/terrain` package that exports terrain data structures, heightmap manipulation functions, splatmap manipulation functions, and terrain mesh generation utilities.
2. THE monorepo SHALL contain a `packages/foliage` package that exports foliage palette types, instance storage structures, and GPU instancing buffer generation utilities.
3. THE `@blud/shared` package SHALL export the new node types (`TerrainNode`, `GridMapNode`, `SplineNode`), their data payloads, and type guard functions (`isTerrainNode`, `isGridMapNode`, `isSplineNode`).
4. THE `@blud/editor-core` package SHALL export command factory functions for terrain sculpting, foliage placement, gridmap tile operations, and spline editing.
5. THE `@blud/tool-system` package SHALL export the updated `ToolId` union type including `"terrain"`, `"foliage"`, `"gridmap"`, `"spline-add"`, and `"spline-edit"`.

### Requirement 29: Worldbuilding Performance for Large Scenes

**User Story:** As a level designer, I want worldbuilding tools to remain responsive when working with large open-world scenes, so that sculpting, painting, and placing operations do not cause frame drops or input lag.

#### Acceptance Criteria

1. THE Terrain_Tool SHALL perform heightmap modifications on a Web Worker thread and apply the results to the main thread asynchronously, keeping the main thread responsive during sculpting.
2. THE Foliage_Tool SHALL batch instance buffer updates and upload them to the GPU in a single operation per frame, avoiding per-instance GPU uploads.
3. THE GridMap_Tool SHALL use spatial indexing (e.g., a hash map keyed by grid coordinates) for tile lookups, ensuring that paint and erase operations complete in constant time per cell regardless of total tile count.
4. WHEN a terrain heightmap exceeds 512x512 resolution, THE Terrain_Tool SHALL process sculpting operations in chunked regions rather than the full heightmap to maintain interactive frame rates.
5. THE Renderer SHALL use frustum culling for terrain chunks, foliage instance groups, and gridmap tile clusters so that off-screen geometry does not consume draw calls or GPU resources.