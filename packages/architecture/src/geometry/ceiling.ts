import { createEditableMeshFromPolygons, type EditableMeshPolygon } from "@blud/geometry-kernel";
import { type EditableMesh } from "@blud/shared";

export function buildCeiling(_params: {
  width: number;
  depth: number;
  thickness: number;
  height: number;
  materialId?: string;
}): EditableMesh {
  // TODO: Implement in task 2.4
  const polygons: EditableMeshPolygon[] = [];
  return createEditableMeshFromPolygons(polygons);
}
