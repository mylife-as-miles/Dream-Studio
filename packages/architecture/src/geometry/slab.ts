import { createEditableMeshFromPolygons, type EditableMeshPolygon } from "@blud/geometry-kernel";
import { type EditableMesh } from "@blud/shared";

export function buildSlab(_params: {
  width: number;
  depth: number;
  thickness: number;
  materialId?: string;
}): EditableMesh {
  // TODO: Implement in task 2.3
  const polygons: EditableMeshPolygon[] = [];
  return createEditableMeshFromPolygons(polygons);
}
