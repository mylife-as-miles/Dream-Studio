import { createEditableMeshFromPolygons, type EditableMeshPolygon } from "@blud/geometry-kernel";
import { vec3, type EditableMesh } from "@blud/shared";

export function buildSlab(params: {
  width: number;
  depth: number;
  thickness: number;
  materialId?: string;
}): EditableMesh {
  const width = Math.max(0.1, params.width);
  const depth = Math.max(0.1, params.depth);
  const thickness = Math.max(0.1, params.thickness);
  const { materialId } = params;

  const halfW = width * 0.5;
  const halfD = depth * 0.5;

  // Slab: top face at y=0, extends downward to y=-thickness
  const top = 0;
  const bottom = -thickness;

  const polygons: EditableMeshPolygon[] = [
    // Top face (y=0)
    { materialId, positions: [vec3(-halfW, top, -halfD), vec3(halfW, top, -halfD), vec3(halfW, top, halfD), vec3(-halfW, top, halfD)] },
    // Bottom face (y=-thickness)
    { materialId, positions: [vec3(-halfW, bottom, halfD), vec3(halfW, bottom, halfD), vec3(halfW, bottom, -halfD), vec3(-halfW, bottom, -halfD)] },
    // Front face (+Z)
    { materialId, positions: [vec3(-halfW, bottom, halfD), vec3(-halfW, top, halfD), vec3(halfW, top, halfD), vec3(halfW, bottom, halfD)] },
    // Back face (-Z)
    { materialId, positions: [vec3(halfW, bottom, -halfD), vec3(halfW, top, -halfD), vec3(-halfW, top, -halfD), vec3(-halfW, bottom, -halfD)] },
    // Left face (-X)
    { materialId, positions: [vec3(-halfW, bottom, -halfD), vec3(-halfW, top, -halfD), vec3(-halfW, top, halfD), vec3(-halfW, bottom, halfD)] },
    // Right face (+X)
    { materialId, positions: [vec3(halfW, bottom, halfD), vec3(halfW, top, halfD), vec3(halfW, top, -halfD), vec3(halfW, bottom, -halfD)] },
  ];

  return createEditableMeshFromPolygons(polygons);
}
