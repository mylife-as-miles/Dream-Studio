import { createEditableMeshFromPolygons, type EditableMeshPolygon } from "@blud/geometry-kernel";
import { vec3, type EditableMesh } from "@blud/shared";

const FRAME_THICKNESS = 0.05;

/**
 * Build a rectangular frame (4 thin rectangles forming an outline).
 * The frame lies in the XY plane, centered on X, with bottom at yOffset.
 */
function buildFrame(
  width: number,
  height: number,
  yOffset: number,
  materialId: string | undefined,
): EditableMeshPolygon[] {
  const halfW = width * 0.5;
  const t = FRAME_THICKNESS;
  const halfT = t * 0.5;
  const top = yOffset + height;
  const bottom = yOffset;

  const polygons: EditableMeshPolygon[] = [];

  // Each frame member is a thin box (width × height × thickness in Z)
  // Bottom rail: runs along X at the bottom
  addBox(polygons, materialId, -halfW, bottom, -halfT, halfW, bottom + t, halfT);
  // Top rail: runs along X at the top
  addBox(polygons, materialId, -halfW, top - t, -halfT, halfW, top, halfT);
  // Left stile: runs along Y on the left
  addBox(polygons, materialId, -halfW, bottom + t, -halfT, -halfW + t, top - t, halfT);
  // Right stile: runs along Y on the right
  addBox(polygons, materialId, halfW - t, bottom + t, -halfT, halfW, top - t, halfT);

  return polygons;
}

/** Add 6 faces for an axis-aligned box defined by min/max corners. */
function addBox(
  polygons: EditableMeshPolygon[],
  materialId: string | undefined,
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
): void {
  // Front (+Z)
  polygons.push({ materialId, positions: [vec3(x0, y0, z1), vec3(x1, y0, z1), vec3(x1, y1, z1), vec3(x0, y1, z1)] });
  // Back (-Z)
  polygons.push({ materialId, positions: [vec3(x1, y0, z0), vec3(x0, y0, z0), vec3(x0, y1, z0), vec3(x1, y1, z0)] });
  // Top (+Y)
  polygons.push({ materialId, positions: [vec3(x0, y1, z1), vec3(x1, y1, z1), vec3(x1, y1, z0), vec3(x0, y1, z0)] });
  // Bottom (-Y)
  polygons.push({ materialId, positions: [vec3(x1, y0, z1), vec3(x0, y0, z1), vec3(x0, y0, z0), vec3(x1, y0, z0)] });
  // Left (-X)
  polygons.push({ materialId, positions: [vec3(x0, y0, z0), vec3(x0, y0, z1), vec3(x0, y1, z1), vec3(x0, y1, z0)] });
  // Right (+X)
  polygons.push({ materialId, positions: [vec3(x1, y0, z1), vec3(x1, y0, z0), vec3(x1, y1, z0), vec3(x1, y1, z1)] });
}

export function buildItem(params: {
  itemType: "door" | "window" | "light-fixture";
  width: number;
  height: number;
  materialId?: string;
}): EditableMesh {
  const width = Math.max(0.1, params.width);
  const height = Math.max(0.1, params.height);
  const { itemType, materialId } = params;

  let polygons: EditableMeshPolygon[];

  switch (itemType) {
    case "door":
      // Door frame at ground level (y=0)
      polygons = buildFrame(width, height, 0, materialId);
      break;

    case "window":
      // Window frame offset by sill height of 0.9
      polygons = buildFrame(width, height, 0.9, materialId);
      break;

    case "light-fixture":
      // Small box centered at origin: width × 0.05 × width
      polygons = [];
      addBox(polygons, materialId, -width * 0.5, -0.025, -width * 0.5, width * 0.5, 0.025, width * 0.5);
      break;
  }

  return createEditableMeshFromPolygons(polygons);
}
