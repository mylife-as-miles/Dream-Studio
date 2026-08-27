import { createMachine } from "xstate";

/**
 * Tools that operate on ordinary scene geometry.
 *
 * `sculpt` and `brush` here are the generic mesh tools; they are unrelated to
 * the terrain brushes below, which is why the terrain set carries its own
 * prefix rather than overloading these ids.
 */
export type CoreToolId =
  | "select"
  | "transform"
  | "brush"
  | "clip"
  | "extrude"
  | "mesh-edit"
  | "sculpt"
  | "path-add"
  | "path-edit";

/**
 * Mesh-terrain authoring tools.
 *
 * These drive the ported Mesh Terrain Lab authoring core: brush strokes in
 * either domain, weight painting across the four material channels, local
 * density changes, swept tunnel CSG, and camera-directed cave digging.
 */
export type TerrainToolId =
  | "terrain-sculpt"
  | "terrain-paint"
  | "terrain-density"
  | "terrain-tunnel"
  | "terrain-dig";

export type ToolId = CoreToolId | TerrainToolId;

export const terrainToolIds = [
  "terrain-sculpt",
  "terrain-paint",
  "terrain-density",
  "terrain-tunnel",
  "terrain-dig"
] as const satisfies readonly TerrainToolId[];

export function isTerrainToolId(toolId: ToolId): toolId is TerrainToolId {
  return (terrainToolIds as readonly string[]).includes(toolId);
}

export const defaultToolId: ToolId = "select";

export type ToolSession = {
  toolId: ToolId;
  machine: ReturnType<typeof createToolMachine>;
};

export function createToolMachine(toolId: ToolId) {
  return createMachine({
    id: `tool:${toolId}`,
    initial: "idle",
    states: {
      idle: {
        on: {
          HOVER: "hover",
          DRAG_START: "drag"
        }
      },
      hover: {
        on: {
          DRAG_START: "drag",
          LEAVE: "idle"
        }
      },
      drag: {
        on: {
          COMMIT: "commit",
          CANCEL: "cancel"
        }
      },
      commit: {
        always: "idle"
      },
      cancel: {
        always: "idle"
      }
    }
  });
}

export function createToolSession(toolId: ToolId): ToolSession {
  return {
    toolId,
    machine: createToolMachine(toolId)
  };
}
