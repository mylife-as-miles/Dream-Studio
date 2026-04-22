import { createEditableMeshFromPolygons, type EditableMeshPolygon } from "@blud/geometry-kernel";
import { type EditableMesh } from "@blud/shared";

export function buildWall(_params: {
  width: number;
  height: number;
  thickness: number;
  materialId?: string;
}): EditableMesh {
  // TODO: Implement in task 2.2
  const polygons: EditableMeshPolygon[] = [];
  return createEditableMeshFromPolygons(polygons);
}
