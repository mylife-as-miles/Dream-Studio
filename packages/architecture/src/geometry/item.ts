import { createEditableMeshFromPolygons, type EditableMeshPolygon } from "@blud/geometry-kernel";
import { type EditableMesh } from "@blud/shared";

export function buildItem(_params: {
  itemType: "door" | "window" | "light-fixture";
  width: number;
  height: number;
  materialId?: string;
}): EditableMesh {
  // TODO: Implement in task 2.6
  const polygons: EditableMeshPolygon[] = [];
  return createEditableMeshFromPolygons(polygons);
}
