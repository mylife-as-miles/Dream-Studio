import { createEditableMeshFromPolygons, type EditableMeshPolygon } from "@blud/geometry-kernel";
import { type EditableMesh } from "@blud/shared";

export function buildRoof(_params: {
  width: number;
  depth: number;
  pitchAngle: number;
  overhang: number;
  materialId?: string;
}): EditableMesh {
  // TODO: Implement in task 2.5
  const polygons: EditableMeshPolygon[] = [];
  return createEditableMeshFromPolygons(polygons);
}
