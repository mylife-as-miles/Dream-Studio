import type { CopilotToolDeclaration } from "./types";

export const COPILOT_TOOL_DECLARATIONS: CopilotToolDeclaration[] = [
  // ── Placement ───────────────────────────────────────────────
  {
    name: "place_blockout_room",
    description:
      "Places a blockout room (enclosed box with walls, floor, ceiling). Open sides remove entire wall/floor/ceiling planes for coarse full-side openings only. Position is the center-bottom of the room.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "World X position of room center" },
        y: { type: "number", description: "World Y position of room bottom (usually 0 for ground level)" },
        z: { type: "number", description: "World Z position of room center" },
        sizeX: { type: "number", description: "Room width in meters (X axis)" },
        sizeY: { type: "number", description: "Room height in meters (Y axis)" },
        sizeZ: { type: "number", description: "Room depth in meters (Z axis)" },
        openSides: {
          type: "array",
          items: { type: "string", enum: ["north", "south", "east", "west", "top", "bottom"] },
          description: "Whole sides to leave open. This removes the entire wall, floor, or ceiling plane and is not suitable for doorway- or hallway-sized openings."
        },
        materialId: { type: "string", description: "Material ID to apply. Use list_materials to see available IDs." },
        name: { type: "string", description: "Display name for the room node" }
      },
      required: ["x", "y", "z", "sizeX", "sizeY", "sizeZ"]
    }
  },
  {
    name: "place_blockout_platform",
    description:
      "Places a flat blockout mesh platform (floor slab, roof, shelf). Position is the center of the platform volume.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "World X position" },
        y: { type: "number", description: "World Y position (center of slab thickness)" },
        z: { type: "number", description: "World Z position" },
        sizeX: { type: "number", description: "Platform width (X)" },
        sizeY: { type: "number", description: "Platform thickness (Y), typically 0.25-0.5" },
        sizeZ: { type: "number", description: "Platform depth (Z)" },
        materialId: { type: "string", description: "Material ID" },
        name: { type: "string", description: "Display name" }
      },
      required: ["x", "y", "z", "sizeX", "sizeY", "sizeZ"]
    }
  },
  {
    name: "place_blockout_stairs",
    description:
      "Places a parametric staircase with optional landings. Position is the center-bottom of the bottom landing. Returns topLandingCenter for chaining connections.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "World X position of stair base" },
        y: { type: "number", description: "World Y position of stair base (bottom)" },
        z: { type: "number", description: "World Z position of stair base" },
        stepCount: { type: "number", description: "Number of steps" },
        stepHeight: { type: "number", description: "Height of each step in meters (typical: 0.2)" },
        treadDepth: { type: "number", description: "Depth of each step tread in meters (typical: 0.3)" },
        width: { type: "number", description: "Stair width in meters" },
        direction: {
          type: "string",
          enum: ["north", "south", "east", "west"],
          description: "Direction the stairs ascend toward (default: north)"
        },
        materialId: { type: "string", description: "Material ID" },
        name: { type: "string", description: "Display name" }
      },
      required: ["x", "y", "z", "stepCount", "stepHeight", "treadDepth", "width"]
    }
  },
  {
    name: "place_primitive",
    description:
      "Places a parametric primitive shape (cube, sphere, cylinder, cone). Use it for static blockout primitives or physics props.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "World X position" },
        y: { type: "number", description: "World Y position" },
        z: { type: "number", description: "World Z position" },
        role: { type: "string", enum: ["brush", "prop"], description: "brush = static blockout primitive, prop = physics object" },
        shape: { type: "string", enum: ["cube", "sphere", "cylinder", "cone"], description: "Primitive shape" },
        sizeX: { type: "number", description: "Size X (default: 2)" },
        sizeY: { type: "number", description: "Size Y (default: 2, or 3 for cylinder/cone)" },
        sizeZ: { type: "number", description: "Size Z (default: 2)" },
        materialId: { type: "string", description: "Material ID to apply directly. Avoids needing a separate assign_material call." },
        name: { type: "string", description: "Display name" }
      },
      required: ["x", "y", "z", "role", "shape"]
    }
  },
  {
    name: "place_brush",
    description:
      "Legacy-named compatibility tool that places a simple axis-aligned mesh box. Default is a 4x3x4 box. Prefer mesh editing workflows after placement.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "World X position" },
        y: { type: "number", description: "World Y position" },
        z: { type: "number", description: "World Z position" },
        sizeX: { type: "number", description: "Brush width (default: 4)" },
        sizeY: { type: "number", description: "Brush height (default: 3)" },
        sizeZ: { type: "number", description: "Brush depth (default: 4)" },
        name: { type: "string", description: "Display name" }
      },
      required: ["x", "y", "z"]
    }
  },
  {
    name: "place_light",
    description: "Places a light in the scene. Types: point (local area), directional (sun), spot (focused cone), ambient (global fill), hemisphere (sky/ground).",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "World X position" },
        y: { type: "number", description: "World Y position" },
        z: { type: "number", description: "World Z position" },
        type: {
          type: "string",
          enum: ["point", "directional", "spot", "ambient", "hemisphere"],
          description: "Light type"
        },
        color: { type: "string", description: "Hex color (e.g. '#ffffff')" },
        intensity: { type: "number", description: "Light intensity" }
      },
      required: ["x", "y", "z", "type"]
    }
  },
  {
    name: "place_entity",
    description: "Places a gameplay entity (spawn point, NPC, or interactive object). Prefer place_player_spawn for playable start positions.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "World X position" },
        y: { type: "number", description: "World Y position" },
        z: { type: "number", description: "World Z position" },
        rotationY: { type: "number", description: "Yaw rotation in radians" },
        type: {
          type: "string",
          enum: ["player-spawn", "npc-spawn", "smart-object"],
          description: "Entity type"
        },
        name: { type: "string", description: "Display name" }
      },
      required: ["x", "y", "z", "type"]
    }
  },
  {
    name: "place_player_spawn",
    description: "Places a player-spawn entity. Use this for playable maps instead of generic entity placement.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "World X position" },
        y: { type: "number", description: "World Y position" },
        z: { type: "number", description: "World Z position" },
        rotationY: { type: "number", description: "Yaw rotation in radians" },
        name: { type: "string", description: "Display name" }
      },
      required: ["x", "y", "z"]
    }
  },

  {
    name: "place_skatepark_element",
    description: "Places a procedural skatepark element (ramps, rails, bowls, etc.). Position is the center-bottom of the element.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "World X position" },
        y: { type: "number", description: "World Y position (bottom)" },
        z: { type: "number", description: "World Z position" },
        type: {
          type: "string",
          enum: [
            "quarter-pipe", "half-pipe", "bank", "spine", "gap-to-rail", "floor",
            "ledge", "rail", "stair-set", "hubba", "bowl", "taco", "handrail", "kicker"
          ],
          description: "Type of skatepark element"
        },
        rotationY: { type: "number", description: "Rotation around Y axis in radians (default: 0)" },
        width: { type: "number", description: "Standard width (default: 4)" },
        height: { type: "number", description: "Standard height (default: 2)" },
        length: { type: "number", description: "Standard length/depth (default: 4)" },
        materialId: { type: "string", description: "Specific material ID (e.g. 'material:skate:concrete', 'material:skate:plywood', 'material:skate:metal')" },
        name: { type: "string", description: "Display name" }
      },
      required: ["x", "y", "z", "type"]
    }
  },

  // ── Transform ───────────────────────────────────────────────
  {
    name: "place_architecture_element",
    description: "Places an architecture element (wall, slab, ceiling, roof, door, window, light fixture). Position is the center-bottom of the element.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "World X position" },
        y: { type: "number", description: "World Y position (bottom)" },
        z: { type: "number", description: "World Z position" },
        type: {
          type: "string",
          enum: ["wall", "slab", "ceiling", "roof", "item"],
          description: "Architecture element type"
        },
        width: { type: "number", description: "Width in meters (default: 4)" },
        height: { type: "number", description: "Height in meters (default: 3 for walls, 0.2 for slabs)" },
        depth: { type: "number", description: "Depth in meters (default: 4 for slabs/ceilings/roofs)" },
        thickness: { type: "number", description: "Thickness in meters (default: 0.2 for walls, 0.15 for ceilings)" },
        pitchAngle: { type: "number", description: "Roof pitch angle in degrees, 0 for flat (default: 30)" },
        overhang: { type: "number", description: "Roof overhang in meters (default: 0.3)" },
        itemType: { type: "string", enum: ["door", "window", "light-fixture"], description: "Item sub-type (required when type is 'item')" },
        rotationY: { type: "number", description: "Rotation around Y axis in radians (default: 0)" },
        materialId: { type: "string", description: "Material ID (defaults to architecture material for the element type)" },
        name: { type: "string", description: "Display name" }
      },
      required: ["x", "y", "z", "type"]
    }
  },

  // ── Transform ───────────────────────────────────────────────
  {
    name: "translate_nodes",
    description: "Moves nodes by a relative offset (delta). Does not set absolute position — adds delta to current position.",
    parameters: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" }, description: "Node IDs to move" },
        dx: { type: "number", description: "X offset" },
        dy: { type: "number", description: "Y offset" },
        dz: { type: "number", description: "Z offset" }
      },
      required: ["nodeIds", "dx", "dy", "dz"]
    }
  },
  {
    name: "set_node_transform",
    description: "Sets a node's absolute position, rotation, and scale.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Node ID" },
        x: { type: "number", description: "Absolute X position" },
        y: { type: "number", description: "Absolute Y position" },
        z: { type: "number", description: "Absolute Z position" },
        rotationX: { type: "number", description: "Rotation X in radians" },
        rotationY: { type: "number", description: "Rotation Y in radians" },
        rotationZ: { type: "number", description: "Rotation Z in radians" },
        scaleX: { type: "number", description: "Scale X" },
        scaleY: { type: "number", description: "Scale Y" },
        scaleZ: { type: "number", description: "Scale Z" }
      },
      required: ["nodeId", "x", "y", "z"]
    }
  },
  {
    name: "duplicate_nodes",
    description: "Duplicates nodes with a position offset. Returns the new node IDs.",
    parameters: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" }, description: "Node IDs to duplicate" },
        offsetX: { type: "number", description: "X offset for duplicates" },
        offsetY: { type: "number", description: "Y offset for duplicates" },
        offsetZ: { type: "number", description: "Z offset for duplicates" }
      },
      required: ["nodeIds", "offsetX", "offsetY", "offsetZ"]
    }
  },
  {
    name: "mirror_nodes",
    description: "Mirrors (flips) nodes across the specified axis.",
    parameters: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" }, description: "Node IDs to mirror" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Axis to mirror across" }
      },
      required: ["nodeIds", "axis"]
    }
  },
  {
    name: "delete_nodes",
    description: "Deletes nodes and/or entities by their IDs. Also removes all children.",
    parameters: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "Node or entity IDs to delete" }
      },
      required: ["ids"]
    }
  },

  // ── Brush ───────────────────────────────────────────────────
  {
    name: "split_brush",
    description: "Legacy brush-only tool. Splits brush nodes at their midpoint along the specified axis. Returns the new node IDs.",
    parameters: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" }, description: "Brush node IDs to split" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Axis to split along" }
      },
      required: ["nodeIds", "axis"]
    }
  },
  {
    name: "extrude_brush",
    description: "Legacy brush-only tool. Extrudes (grows) brush nodes along an axis by a given amount.",
    parameters: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" }, description: "Brush node IDs" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Extrusion axis" },
        amount: { type: "number", description: "Extrusion distance in meters" },
        direction: { type: "string", enum: ["-1", "1"], description: "Extrusion direction: '-1' (negative) or '1' (positive)" }
      },
      required: ["nodeIds", "axis", "amount", "direction"]
    }
  },
  {
    name: "offset_brush_face",
    description: "Legacy brush-only tool. Moves a single face of a brush inward or outward.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Brush node ID" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Face axis" },
        side: { type: "string", enum: ["min", "max"], description: "Which face (min or max)" },
        amount: { type: "number", description: "Offset amount (positive = outward)" }
      },
      required: ["nodeId", "axis", "side", "amount"]
    }
  },
  {
    name: "assign_material_to_brushes",
    description: "Legacy brush-only tool. Assigns a material to all faces of the specified brush nodes.",
    parameters: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" }, description: "Brush node IDs" },
        materialId: { type: "string", description: "Material ID to assign" }
      },
      required: ["nodeIds", "materialId"]
    }
  },

  // ── Materials ───────────────────────────────────────────────
  {
    name: "create_material",
    description: "Creates or updates a material in the scene library. The ID is auto-generated as 'material:custom:<slug>' from the name (e.g. name 'Dark Wood' → id 'material:custom:dark-wood'). You can use this predictable ID immediately in assign_material calls.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Material display name" },
        color: { type: "string", description: "Hex color (e.g. '#ff6633')" },
        category: { type: "string", enum: ["flat", "blockout", "custom"], description: "Material category (default: custom)" },
        metalness: { type: "number", description: "Metalness 0-1 (default: 0)" },
        roughness: { type: "number", description: "Roughness 0-1 (default: 0.8)" }
      },
      required: ["name", "color"]
    }
  },
  {
    name: "assign_material",
    description: "Assigns a material to nodes (all faces) or specific faces on nodes.",
    parameters: {
      type: "object",
      properties: {
        targets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string", description: "Node ID" },
              faceIds: { type: "array", items: { type: "string" }, description: "Optional face IDs (omit for all faces)" }
            },
            required: ["nodeId"]
          },
          description: "Nodes (and optional faces) to assign material to"
        },
        materialId: { type: "string", description: "Material ID to assign" }
      },
      required: ["targets", "materialId"]
    }
  },
  {
    name: "set_uv_scale",
    description: "Sets UV texture tiling scale on nodes or specific faces.",
    parameters: {
      type: "object",
      properties: {
        targets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              faceIds: { type: "array", items: { type: "string" } }
            },
            required: ["nodeId"]
          }
        },
        scaleX: { type: "number", description: "UV scale X" },
        scaleY: { type: "number", description: "UV scale Y" }
      },
      required: ["targets", "scaleX", "scaleY"]
    }
  },

  // ── Scene management ────────────────────────────────────────
  {
    name: "group_nodes",
    description: "Groups nodes/entities under a new group node. Returns the group ID.",
    parameters: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "Node/entity IDs to group" }
      },
      required: ["ids"]
    }
  },
  {
    name: "select_nodes",
    description: "Sets the editor selection to the given node/entity IDs.",
    parameters: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "IDs to select" }
      },
      required: ["ids"]
    }
  },
  {
    name: "clear_selection",
    description: "Clears the current editor selection.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "undo",
    description: "Undoes the last editor command.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "set_scene_settings",
    description:
      "Updates scene settings (world physics, fog, ambient, skybox, grass wind, player config). Skybox uses world.skybox; grass wind animates the procedural grass field shader.",
    parameters: {
      type: "object",
      properties: {
        gravityX: { type: "number", description: "Gravity X (default: 0)" },
        gravityY: { type: "number", description: "Gravity Y (default: -9.81)" },
        gravityZ: { type: "number", description: "Gravity Z (default: 0)" },
        physicsEnabled: { type: "boolean", description: "Enable physics simulation" },
        ambientColor: { type: "string", description: "Ambient light hex color" },
        ambientIntensity: { type: "number", description: "Ambient light intensity" },
        fogColor: { type: "string", description: "Fog hex color" },
        fogNear: { type: "number", description: "Fog near distance" },
        fogFar: { type: "number", description: "Fog far distance" },
        skyboxEnabled: { type: "boolean", description: "Enable HDR/image skybox" },
        skyboxSource: { type: "string", description: "Skybox URL or asset path (HDR or image per skyboxFormat)" },
        skyboxFormat: { type: "string", enum: ["hdr", "image"], description: "Skybox file type" },
        skyboxName: { type: "string", description: "Display label for the sky preset" },
        skyboxIntensity: { type: "number", description: "Skybox display intensity" },
        skyboxLightingIntensity: { type: "number", description: "How strongly the sky contributes to scene lighting (when affectsLighting)" },
        skyboxBlur: { type: "number", description: "IBL / sky blur amount" },
        skyboxAffectsLighting: { type: "boolean", description: "Whether skybox drives environmental lighting" },
        grassEnabled: { type: "boolean", description: "Enable procedural grass field in lit viewport" },
        grassWindSpeed: { type: "number", description: "Grass shader wind speed" },
        grassWindStrength: { type: "number", description: "Grass shader wind displacement strength" },
        cameraMode: { type: "string", enum: ["fps", "third-person", "top-down"], description: "Player camera mode" },
        playerHeight: { type: "number", description: "Player height in meters" },
        movementSpeed: { type: "number", description: "Player movement speed" },
        jumpHeight: { type: "number", description: "Player jump height" }
      }
    }
  },
  {
    name: "generate_game_html",
    description:
      "Call this after you have written the complete standalone HTML game in a ```html code block in your message. This tool registers the game artifact so it appears as a playable card in the UI. Do NOT put the HTML in the tool arguments — write it in your message text first, then call this tool with only the title. Default to a premium, polished UI/HUD/layout for game, HTML, browser-based, and viewport-facing experiences unless the user explicitly wants a minimal or debug look.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "A short, descriptive title for the game shown in the UI (e.g. 'Terrain Vehicle Demo')"
        }
      },
      required: ["title"]
    }
  },
  {
    name: "push_scene_to_connected_game",
    description:
      "Pushes the current editor scene into the connected scaffolded game dev server. Use it when the user asks to sync or send the current scene to the game.",
    parameters: {
      type: "object",
      properties: {
        forceSwitch: {
          type: "boolean",
          description: "If true, request the game to reload directly into the pushed scene after syncing."
        },
        gameId: {
          type: "string",
          description: "Optional specific connected game ID when more than one game is available."
        },
        projectName: {
          type: "string",
          description: "Optional project display name override for the pushed scene."
        },
        projectSlug: {
          type: "string",
          description: "Optional slug override for the target scene folder."
        }
      }
    }
  },

  // ── Read-only queries ───────────────────────────────────────
  {
    name: "list_nodes",
    description: "Lists the scene node outline as a lightweight hierarchy. Returns IDs, names, kinds, child nodes, and attached entities, but not full node data.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "list_entities",
    description: "Lists entities in a lightweight form with ID, name, type, and parentId. Use get_entity_details for full data.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "list_materials",
    description: "Lists all materials in the scene with their ID, name, color, and category.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "list_scene_paths",
    description: "Lists all scene-level waypoint paths with ids, names, loop state, and points.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "list_scene_events",
    description: "Lists the standard and custom gameplay events available in the scene.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "list_hook_types",
    description: "Lists all supported gameplay hook types, including field paths, defaults, emitted events, and listened events.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "get_node_details",
    description: "Gets full details of a specific node, including transform, worldTransform, hierarchy links, hooks, metadata, and node data.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Node ID to inspect" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "get_entity_details",
    description: "Gets full details of a specific entity, including transform, worldTransform, parentId, properties, and hooks.",
    parameters: {
      type: "object",
      properties: {
        entityId: { type: "string", description: "Entity ID to inspect" }
      },
      required: ["entityId"]
    }
  },
  {
    name: "get_scene_settings",
    description: "Gets current scene settings. This is the canonical source for player scale, jump height, movement, camera mode, physics, fog, and ambient lighting.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "create_scene_path",
    description: "Creates a new scene-level waypoint path. Paths are referenced by hook config such as path_mover.pathId.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Optional explicit path id" },
        name: { type: "string", description: "Display name" },
        loop: { type: "boolean", description: "Whether the path loops" },
        points: {
          type: "array",
          items: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              z: { type: "number" }
            },
            required: ["x", "y", "z"]
          },
          description: "Waypoint points in world space"
        }
      },
      required: ["name", "points"]
    }
  },
  {
    name: "update_scene_path",
    description: "Updates a scene path by replacing any provided fields such as name, loop, or points.",
    parameters: {
      type: "object",
      properties: {
        pathId: { type: "string", description: "Path id to update" },
        name: { type: "string", description: "New display name" },
        loop: { type: "boolean", description: "Whether the path loops" },
        points: {
          type: "array",
          items: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              z: { type: "number" }
            },
            required: ["x", "y", "z"]
          },
          description: "Replacement waypoint points in world space"
        }
      },
      required: ["pathId"]
    }
  },
  {
    name: "delete_scene_path",
    description: "Deletes a scene-level waypoint path.",
    parameters: {
      type: "object",
      properties: {
        pathId: { type: "string", description: "Path id to delete" }
      },
      required: ["pathId"]
    }
  },
  {
    name: "add_hook",
    description: "Attaches a gameplay hook to a node or entity using the canonical default config for that hook type, then applies any provided config overrides.",
    parameters: {
      type: "object",
      properties: {
        targetKind: { type: "string", enum: ["node", "entity"], description: "Whether the hook attaches to a node or entity" },
        targetId: { type: "string", description: "Node or entity id" },
        hookType: { type: "string", description: "Hook type. Use list_hook_types to inspect supported types." },
        enabled: { type: "boolean", description: "Whether the hook starts enabled" },
        defaultPathId: { type: "string", description: "Optional default path id for path_mover hooks" },
        config: {
          type: "object",
          additionalProperties: true,
          description: "Optional config override object merged into the canonical default config"
        }
      },
      required: ["targetKind", "targetId", "hookType"]
    }
  },
  {
    name: "set_hook_value",
    description: "Sets a specific hook config value by dot path on an existing node/entity hook.",
    parameters: {
      type: "object",
      properties: {
        targetKind: { type: "string", enum: ["node", "entity"], description: "Whether the hook is on a node or entity" },
        targetId: { type: "string", description: "Node or entity id" },
        hookId: { type: "string", description: "Hook id to edit" },
        path: { type: "string", description: "Dot path inside hook.config, for example 'pathId' or 'trigger.event'" },
        value: {
          description: "New value to write at the config path"
        }
      },
      required: ["targetKind", "targetId", "hookId", "path", "value"]
    }
  },
  {
    name: "remove_hook",
    description: "Removes a gameplay hook from a node or entity.",
    parameters: {
      type: "object",
      properties: {
        targetKind: { type: "string", enum: ["node", "entity"], description: "Whether the hook is on a node or entity" },
        targetId: { type: "string", description: "Node or entity id" },
        hookId: { type: "string", description: "Hook id to remove" }
      },
      required: ["targetKind", "targetId", "hookId"]
    }
  },
  {
    name: "get_mesh_topology",
    description: "Returns the face IDs, vertex IDs with positions, face centers, face normals, and edges for a mesh node. Use this before mesh editing operations to discover which faces/vertices/edges to target.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID to inspect" }
      },
      required: ["nodeId"]
    }
  },

  // ── Mesh editing ────────────────────────────────────────────
  {
    name: "extrude_mesh_faces",
    description: "Extrude one or more faces of a mesh node along their normal by an amount. Use get_mesh_topology first to find face IDs.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Face IDs to extrude" },
        amount: { type: "number", description: "Extrusion distance in meters (positive = outward)" }
      },
      required: ["nodeId", "faceIds", "amount"]
    }
  },
  {
    name: "extrude_mesh_edge",
    description: "Extrude a boundary edge of a mesh outward, creating a new quad face.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        vertexId1: { type: "string", description: "First vertex ID of the edge" },
        vertexId2: { type: "string", description: "Second vertex ID of the edge" },
        amount: { type: "number", description: "Extrusion distance" }
      },
      required: ["nodeId", "vertexId1", "vertexId2", "amount"]
    }
  },
  {
    name: "bevel_mesh_edges",
    description: "Bevel (chamfer/round) edges of a mesh. Creates smooth transitions at sharp edges.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        edges: { type: "array", items: { type: "array", items: { type: "string" } }, description: "Edges as [[vertexId1, vertexId2], ...] pairs" },
        width: { type: "number", description: "Bevel width in meters" },
        steps: { type: "number", description: "Number of bevel segments (1=flat chamfer, 3+=smooth round)" },
        profile: { type: "string", enum: ["flat", "round"], description: "Bevel profile shape (default: flat)" }
      },
      required: ["nodeId", "edges", "width", "steps"]
    }
  },
  {
    name: "inset_mesh_faces",
    description: "Inset selected faces to create an inner face loop. Use it for panel lines, door/window frames, and prep before extrusion.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Face IDs to inset" },
        amount: { type: "number", description: "Inset amount in meters" }
      },
      required: ["nodeId", "faceIds", "amount"]
    }
  },
  {
    name: "bridge_mesh_edges",
    description: "Bridge two selected boundary edges with a new face. Use get_mesh_topology first and pass exactly two edge pairs.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        edges: { type: "array", items: { type: "array", items: { type: "string" } }, description: "Two edges as [[vertexId1, vertexId2], [vertexId3, vertexId4]]" }
      },
      required: ["nodeId", "edges"]
    }
  },
  {
    name: "poke_mesh_faces",
    description: "Poke selected faces into triangles from a new center vertex. Useful for radial detail, peaks, and controlled triangulation.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Face IDs to poke" }
      },
      required: ["nodeId", "faceIds"]
    }
  },
  {
    name: "triangulate_mesh_faces",
    description: "Triangulate selected faces, or all faces when faceIds is omitted. Useful before runtime baking or cleanup.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Optional face IDs to triangulate" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "quadrangulate_mesh_faces",
    description: "Attempt to rebuild selected triangle pairs into quads. Use after triangulation or cleanup when quad authoring is preferred.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Face IDs to quadrangulate" }
      },
      required: ["nodeId", "faceIds"]
    }
  },
  {
    name: "solidify_mesh",
    description: "Add shell thickness to a mesh as a one-shot topology edit. Prefer add_mesh_modeling_modifier type=solidify for live/non-destructive work.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        thickness: { type: "number", description: "Shell thickness in meters" }
      },
      required: ["nodeId", "thickness"]
    }
  },
  {
    name: "mirror_mesh",
    description: "Mirror a mesh across one local axis as a one-shot topology edit. Prefer the modeling stack for reusable symmetry.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Mirror axis" }
      },
      required: ["nodeId", "axis"]
    }
  },
  {
    name: "weld_mesh_vertices_by_distance",
    description: "Merge vertices within a distance threshold. Use for cleanup after boolean, bridge, mirror, import, or remesh-style edits.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        vertexIds: { type: "array", items: { type: "string" }, description: "Optional vertex IDs to restrict the weld" },
        distance: { type: "number", description: "Maximum merge distance in meters" }
      },
      required: ["nodeId", "distance"]
    }
  },
  {
    name: "weld_mesh_vertices_to_target",
    description: "Target-weld source vertices into one target vertex. Use for precise cleanup and snapping holes shut.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        targetVertexId: { type: "string", description: "Vertex ID that receives the weld" },
        sourceVertexIds: { type: "array", items: { type: "string" }, description: "Vertex IDs to merge into the target" }
      },
      required: ["nodeId", "targetVertexId", "sourceVertexIds"]
    }
  },
  {
    name: "subdivide_mesh_face",
    description: "Subdivide a mesh face into smaller faces. Quad faces get a grid pattern, others get radial.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceId: { type: "string", description: "Face ID to subdivide" },
        cuts: { type: "number", description: "Number of cuts (1=2x2 for quads, 2=3x3, etc.)" }
      },
      required: ["nodeId", "faceId", "cuts"]
    }
  },
  {
    name: "cut_mesh_face",
    description: "Cut a mesh face with a line passing through a point, splitting it into two faces.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceId: { type: "string", description: "Face ID to cut" },
        pointX: { type: "number", description: "X coordinate of cut point on the face" },
        pointY: { type: "number", description: "Y coordinate" },
        pointZ: { type: "number", description: "Z coordinate" },
        snapSize: { type: "number", description: "Snap resolution (default: 1)" }
      },
      required: ["nodeId", "faceId", "pointX", "pointY", "pointZ"]
    }
  },
  {
    name: "cut_mesh_between_edges",
    description: "Knife-cut a polygon by connecting the midpoints of two non-adjacent edges on the same face.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        edges: { type: "array", items: { type: "array", items: { type: "string" } }, description: "Exactly two non-adjacent edges as [[vertexId1, vertexId2], [vertexId3, vertexId4]]" }
      },
      required: ["nodeId", "edges"]
    }
  },
  {
    name: "delete_mesh_faces",
    description: "Delete faces from a mesh, leaving real holes. Use only for intentional openings to empty space or adjacent voids, not as a shortcut for doorway- or hallway-sized passages.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Face IDs to delete" }
      },
      required: ["nodeId", "faceIds"]
    }
  },
  {
    name: "merge_mesh_faces",
    description: "Merge adjacent coplanar faces into a single face.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Face IDs to merge (must be coplanar and adjacent)" }
      },
      required: ["nodeId", "faceIds"]
    }
  },
  {
    name: "merge_mesh_vertices",
    description: "Merge multiple vertices to their average position.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        vertexIds: { type: "array", items: { type: "string" }, description: "Vertex IDs to merge" }
      },
      required: ["nodeId", "vertexIds"]
    }
  },
  {
    name: "translate_mesh_vertices",
    description: "Translate selected mesh vertices in world space. Use this to reposition a cap or face region after cutting or extruding.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        vertexIds: { type: "array", items: { type: "string" }, description: "Vertex IDs to move" },
        offsetX: { type: "number", description: "World X offset in meters" },
        offsetY: { type: "number", description: "World Y offset in meters" },
        offsetZ: { type: "number", description: "World Z offset in meters" }
      },
      required: ["nodeId", "vertexIds", "offsetX", "offsetY", "offsetZ"]
    }
  },
  {
    name: "scale_mesh_vertices",
    description: "Scale selected mesh vertices around their centroid or an optional pivot. Use this to widen or narrow an extruded cap before the next extrusion.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        vertexIds: { type: "array", items: { type: "string" }, description: "Vertex IDs to scale" },
        scaleX: { type: "number", description: "World-axis scale factor around the pivot for X" },
        scaleY: { type: "number", description: "World-axis scale factor around the pivot for Y" },
        scaleZ: { type: "number", description: "World-axis scale factor around the pivot for Z" },
        pivotX: { type: "number", description: "Optional pivot X. Defaults to the selected vertices centroid." },
        pivotY: { type: "number", description: "Optional pivot Y. Defaults to the selected vertices centroid." },
        pivotZ: { type: "number", description: "Optional pivot Z. Defaults to the selected vertices centroid." }
      },
      required: ["nodeId", "vertexIds", "scaleX", "scaleY", "scaleZ"]
    }
  },
  {
    name: "fill_mesh_face",
    description: "Create a new face from a loop of boundary vertices, filling a hole in the mesh.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        vertexIds: { type: "array", items: { type: "string" }, description: "Vertex IDs forming the boundary loop (>=3, must be boundary vertices)" }
      },
      required: ["nodeId", "vertexIds"]
    }
  },
  {
    name: "invert_mesh_normals",
    description: "Flip face normals (winding order) on selected or all faces of a mesh.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Face IDs to invert (omit for all faces)" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "arc_mesh_edges",
    description: "Curve straight edges into arcs by inserting interpolated vertices.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        edges: { type: "array", items: { type: "array", items: { type: "string" } }, description: "Edges as [[vertexId1, vertexId2], ...] pairs" },
        offset: { type: "number", description: "Arc height/offset in meters" },
        segments: { type: "number", description: "Number of arc segments (minimum 2)" }
      },
      required: ["nodeId", "edges", "offset", "segments"]
    }
  },
  {
    name: "inflate_mesh",
    description: "Move all vertices of mesh nodes along their averaged normals (inflate/deflate).",
    parameters: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" }, description: "Mesh node IDs" },
        factor: { type: "number", description: "Inflate factor (positive = outward, negative = inward)" }
      },
      required: ["nodeIds", "factor"]
    }
  },
  {
    name: "convert_brush_to_mesh",
    description: "Convert a legacy brush node into an editable mesh node, enabling the preferred face/edge/vertex editing workflow.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Brush node ID to convert" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "capture_mesh_modeling_base",
    description: "Capture the current mesh topology as the base for a live/non-destructive modeling stack.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "rebuild_mesh_modeling_stack",
    description: "Re-evaluate the mesh modeling stack from its captured base topology and current modifiers.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "add_mesh_modeling_modifier",
    description: "Add a live/non-destructive modeling modifier. Supports boolean, mirror, solidify, lattice, remesh, and retopo modifiers.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        type: { type: "string", enum: ["boolean", "mirror", "solidify", "lattice", "remesh", "retopo"], description: "Modifier type" },
        label: { type: "string", description: "Display label" },
        enabled: { type: "boolean", description: "Whether the modifier is enabled" },
        operation: { type: "string", enum: ["union", "difference", "intersect"], description: "Boolean operation" },
        targetNodeId: { type: "string", description: "Boolean target mesh node ID" },
        mode: { type: "string", description: "Boolean mode apply/live, lattice mode bend/twist/taper/shear, or remesh mode cleanup/quad/voxel" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Mirror/lattice axis" },
        weld: { type: "boolean", description: "Mirror weld/symmetry weld toggle" },
        thickness: { type: "number", description: "Solidify thickness in meters" },
        intensity: { type: "number", description: "Lattice intensity" },
        falloff: { type: "number", description: "Lattice falloff" },
        resolution: { type: "number", description: "Remesh resolution" },
        smoothing: { type: "number", description: "Remesh smoothing amount" },
        weldDistance: { type: "number", description: "Cleanup weld distance" },
        preserveBorders: { type: "boolean", description: "Retopo preserve-border toggle" },
        targetFaceCount: { type: "number", description: "Retopo target face count" }
      },
      required: ["nodeId", "type"]
    }
  },
  {
    name: "update_mesh_modeling_modifier",
    description: "Update fields on an existing live modeling modifier by modifierId.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        modifierId: { type: "string", description: "Modifier ID to update" },
        label: { type: "string", description: "Display label" },
        enabled: { type: "boolean", description: "Whether the modifier is enabled" },
        operation: { type: "string", enum: ["union", "difference", "intersect"], description: "Boolean operation" },
        targetNodeId: { type: "string", description: "Boolean target mesh node ID" },
        mode: { type: "string", description: "Boolean, lattice, or remesh mode" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Mirror/lattice axis" },
        weld: { type: "boolean", description: "Mirror weld/symmetry weld toggle" },
        thickness: { type: "number", description: "Solidify thickness in meters" },
        intensity: { type: "number", description: "Lattice intensity" },
        falloff: { type: "number", description: "Lattice falloff" },
        resolution: { type: "number", description: "Remesh resolution" },
        smoothing: { type: "number", description: "Remesh smoothing amount" },
        weldDistance: { type: "number", description: "Cleanup weld distance" },
        preserveBorders: { type: "boolean", description: "Retopo preserve-border toggle" },
        targetFaceCount: { type: "number", description: "Retopo target face count" }
      },
      required: ["nodeId", "modifierId"]
    }
  },
  {
    name: "remove_mesh_modeling_modifier",
    description: "Remove a live/non-destructive modeling modifier from a mesh.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        modifierId: { type: "string", description: "Modifier ID to remove" }
      },
      required: ["nodeId", "modifierId"]
    }
  },
  {
    name: "set_mesh_symmetry",
    description: "Enable or update live symmetry settings for a mesh modeling stack.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        enabled: { type: "boolean", description: "Whether symmetry is enabled" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Symmetry mirror axis" },
        weld: { type: "boolean", description: "Whether symmetry should weld mirrored seams" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "create_mesh_polygroup",
    description: "Create a PolyGroup/face group from selected face IDs for material IDs, retopo regions, LOD planning, and bake masks.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Face IDs to include" },
        name: { type: "string", description: "Group display name" },
        groupId: { type: "string", description: "Optional stable group ID" },
        color: { type: "string", description: "Hex color for the group" }
      },
      required: ["nodeId", "faceIds"]
    }
  },
  {
    name: "assign_faces_to_mesh_polygroup",
    description: "Add more face IDs to an existing PolyGroup.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        groupId: { type: "string", description: "Existing PolyGroup ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Face IDs to add" }
      },
      required: ["nodeId", "groupId", "faceIds"]
    }
  },
  {
    name: "create_mesh_smoothing_group",
    description: "Create a smoothing group over selected faces with a target smoothing angle.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Face IDs to include" },
        name: { type: "string", description: "Group display name" },
        groupId: { type: "string", description: "Optional stable group ID" },
        angle: { type: "number", description: "Smoothing angle in degrees" }
      },
      required: ["nodeId", "faceIds"]
    }
  },
  {
    name: "set_mesh_lod_profiles",
    description: "Author LOD targets for runtime export. Pass profiles with ratios/faceCounts, or ratios for generated profiles.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        ratios: { type: "array", items: { type: "number" }, description: "LOD reduction ratios such as [0.7, 0.4, 0.18]" },
        profiles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              ratio: { type: "number" },
              faceCount: { type: "number" }
            }
          },
          description: "Explicit LOD profiles"
        }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "queue_mesh_bake_outputs",
    description: "Queue bake-map output slots for runtime asset production: normals, AO, curvature, ID masks, and vertex colors.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        kinds: { type: "array", items: { type: "string", enum: ["normals", "ao", "curvature", "id-mask", "vertex-colors"] }, description: "Bake map kinds to queue" },
        resolution: { type: "number", description: "Bake texture resolution, default 2048" },
        sourceGroupId: { type: "string", description: "Optional PolyGroup/source group ID" },
        replaceExisting: { type: "boolean", description: "Replace existing queued outputs for the same kind, default true" }
      },
      required: ["nodeId", "kinds"]
    }
  },
  {
    name: "unwrap_mesh_uvs",
    description: "Create or replace explicit UVs on mesh faces using smart unwrap, planar, box, or cylindrical projection.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Optional face IDs; omit for whole mesh" },
        mode: { type: "string", enum: ["smart", "planar", "box", "cylindrical"], description: "UV unwrap/projection mode" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Projection axis for planar/cylindrical modes" },
        angleThresholdDegrees: { type: "number", description: "Smart unwrap hard-edge seam angle, default 66" },
        margin: { type: "number", description: "Packing margin 0-0.2, default 0.02" },
        scaleU: { type: "number", description: "U scale for projection" },
        scaleV: { type: "number", description: "V scale for projection" },
        offsetU: { type: "number", description: "U offset for projection" },
        offsetV: { type: "number", description: "V offset for projection" }
      },
      required: ["nodeId", "mode"]
    }
  },
  {
    name: "pack_mesh_uvs",
    description: "Pack existing mesh UV islands into 0-1 UV space with deterministic shelf packing.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Optional face IDs; omit for whole mesh" },
        margin: { type: "number", description: "Island margin, default 0.02" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "mark_mesh_uv_seams",
    description: "Mark UV seams using vertex-id edge pairs. Use list_mesh_topology first to inspect vertex IDs and edges.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        edges: { type: "array", items: { type: "array", items: { type: "string" } }, description: "Edges as [[vertexId1, vertexId2], ...]" },
        append: { type: "boolean", description: "Append to existing seams, default true" }
      },
      required: ["nodeId", "edges"]
    }
  },
  {
    name: "normalize_mesh_texel_density",
    description: "Scale selected face UVs to a target texel density for game-production texture consistency.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Optional face IDs; omit for whole mesh" },
        pixelsPerMeter: { type: "number", description: "Target pixels per meter, default 512" },
        textureResolution: { type: "number", description: "Texture resolution in pixels, default 1024" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "paint_mesh_face_material",
    description: "Assign a material to mesh faces and register it as a mesh-local material slot.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Face IDs to paint; omit for all faces" },
        materialId: { type: "string", description: "Material ID from list_materials" }
      },
      required: ["nodeId", "materialId"]
    }
  },
  {
    name: "paint_mesh_vertex_color",
    description: "Paint RGBA vertex colors onto mesh face corners. Hex color is easiest, e.g. #ff8844.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Face IDs to paint; omit for all faces" },
        color: { type: "string", description: "Hex color such as #ffffff" },
        r: { type: "number", description: "Red 0-1 when not using color" },
        g: { type: "number", description: "Green 0-1 when not using color" },
        b: { type: "number", description: "Blue 0-1 when not using color" },
        alpha: { type: "number", description: "Alpha 0-1, default 1" },
        strength: { type: "number", description: "Paint strength 0-1, default 1" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "add_mesh_surface_blend_layer",
    description: "Add or update one of the mesh's up-to-4 PBR texture blend layers, usually from an existing material.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        layerId: { type: "string", description: "Stable blend layer ID. Defaults to blend:<materialId>" },
        materialId: { type: "string", description: "Existing material ID to copy color/textures from" },
        name: { type: "string", description: "Layer display name" },
        color: { type: "string", description: "Fallback layer color" },
        colorTexture: { type: "string", description: "Color texture URL/data URI" },
        normalTexture: { type: "string", description: "Normal texture URL/data URI" },
        metalnessTexture: { type: "string", description: "Metalness texture URL/data URI" },
        roughnessTexture: { type: "string", description: "Roughness texture URL/data URI" },
        metalness: { type: "number", description: "Layer metalness 0-1" },
        roughness: { type: "number", description: "Layer roughness 0-1" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "paint_mesh_texture_blend",
    description: "Paint normalized per-corner weights for a mesh surface blend layer.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        faceIds: { type: "array", items: { type: "string" }, description: "Face IDs to paint; omit for all faces" },
        layerId: { type: "string", description: "Blend layer ID to paint" },
        strength: { type: "number", description: "Paint strength 0-1, default 1" }
      },
      required: ["nodeId", "layerId"]
    }
  },
  {
    name: "add_mesh_projected_decal",
    description: "Add a live projected decal record to a mesh for editor and runtime overlay rendering.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Mesh node ID" },
        decalId: { type: "string", description: "Optional stable decal ID" },
        name: { type: "string", description: "Decal display name" },
        materialId: { type: "string", description: "Optional material ID to copy texture/color from" },
        texture: { type: "string", description: "Optional decal texture URL/data URI" },
        color: { type: "string", description: "Fallback decal color" },
        blendMode: { type: "string", enum: ["normal", "multiply", "add"], description: "Decal blend mode" },
        opacity: { type: "number", description: "Opacity 0-1" },
        x: { type: "number", description: "Local projected decal center X" },
        y: { type: "number", description: "Local projected decal center Y" },
        z: { type: "number", description: "Local projected decal center Z" },
        normalX: { type: "number", description: "Projection normal X" },
        normalY: { type: "number", description: "Projection normal Y" },
        normalZ: { type: "number", description: "Projection normal Z" },
        upX: { type: "number", description: "Decal up vector X" },
        upY: { type: "number", description: "Decal up vector Y" },
        upZ: { type: "number", description: "Decal up vector Z" },
        sizeX: { type: "number", description: "Decal width in mesh-local units" },
        sizeY: { type: "number", description: "Decal height in mesh-local units" },
        depth: { type: "number", description: "Projection depth" },
        faceIds: { type: "array", items: { type: "string" }, description: "Optional target face IDs" }
      },
      required: ["nodeId", "x", "y", "z", "normalX", "normalY", "normalZ", "sizeX", "sizeY"]
    }
  },
  {
    name: "split_brush_at_coordinate",
    description: "Split a brush node at an exact world coordinate along an axis (more precise than split_brush which only splits at the midpoint).",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Brush node ID" },
        axis: { type: "string", enum: ["x", "y", "z"], description: "Axis to split along" },
        coordinate: { type: "number", description: "World coordinate to split at" }
      },
      required: ["nodeId", "axis", "coordinate"]
    }
  }
];

/** Only `generate_game_html` — used when the model's task is a standalone game or browser-based interactive experience */
export const GAME_TOOL_DECLARATIONS: CopilotToolDeclaration[] = [
  COPILOT_TOOL_DECLARATIONS.find((t) => t.name === "generate_game_html")!
];

/**
 * Return `true` when the user's prompt is clearly a standalone-game or browser-based
 * interactive request (not a scene-editing request). In that case we expose only
 * `generate_game_html`
 * instead of the full editor tool catalog so the model context stays lean.
 */
export function isGameGenerationPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const gameKeywords = [
    "make me a game",
    "create a game",
    "build a game",
    "make a game",
    "generate a game",
    "make a playable",
    "create a playable",
    "build a playable",
    "create a prototype",
    "make a prototype",
    "build a prototype",
    "generate a prototype",
    "create a demo",
    "make a demo",
    "build a demo",
    "generate a demo",
    "open world",
    "car game",
    "vehicle game",
    "terrain vehicle",
    "3d game",
    "webgpu game",
    "three.js game",
    "threejs game",
    "standalone game",
    "html game",
    "browser game",
    "browser-based experience",
    "browser based experience",
    "web-based experience",
    "web based experience",
    "standalone html",
    "html prototype",
    "html demo",
    "html experience",
    "interactive prototype",
    "interactive demo",
    "viewport demo",
    "premium viewport demo",
    "platformer",
    "fps game",
    "racing game",
    "shooter game",
    "sandbox game",
    "brick builder",
    "lego",
    "voxel",
    "city builder",
    "build and place",
    "place blocks",
    "block builder",
    "sculpting tool",
    "building tool",
    "building simulator",
    "construction game",
  ];
  return gameKeywords.some((kw) => lower.includes(kw));
}
