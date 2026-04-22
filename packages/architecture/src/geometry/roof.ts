import { createEditableMeshFromPolygons, type EditableMeshPolygon } from "@blud/geometry-kernel";
import { vec3, type EditableMesh } from "@blud/shared";

export function buildRoof(params: {
  width: number;
  depth: number;
  pitchAngle: number;
  overhang: number;
  materialId?: string;
}): EditableMesh {
  const width = Math.max(0.1, params.width);
  const depth = Math.max(0.1, params.depth);
  const pitchAngle = Math.min(89, Math.max(0, params.pitchAngle));
  const overhang = Math.max(0, params.overhang);
  const { materialId } = params;

  const halfW = width * 0.5 + overhang;
  const halfD = depth * 0.5 + overhang;

  if (pitchAngle === 0) {
    // Flat roof — thin horizontal slab at y=0
    const thickness = 0.1;
    const top = thickness;
    const bottom = 0;

    const polygons: EditableMeshPolygon[] = [
      // Top face
      { materialId, positions: [vec3(-halfW, top, -halfD), vec3(halfW, top, -halfD), vec3(halfW, top, halfD), vec3(-halfW, top, halfD)] },
      // Bottom face
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

  // Pitched gabled roof
  // Ridge runs along the Z (depth) axis at the center (x=0)
  // The ridge height is determined by the pitch angle and half-width
  const ridgeHeight = Math.tan((pitchAngle * Math.PI) / 180) * (width * 0.5 + overhang);

  // Base corners at y=0
  const bl_front = vec3(-halfW, 0, halfD);  // bottom-left front
  const br_front = vec3(halfW, 0, halfD);   // bottom-right front
  const bl_back = vec3(-halfW, 0, -halfD);  // bottom-left back
  const br_back = vec3(halfW, 0, -halfD);   // bottom-right back

  // Ridge points at top
  const ridge_front = vec3(0, ridgeHeight, halfD);
  const ridge_back = vec3(0, ridgeHeight, -halfD);

  const polygons: EditableMeshPolygon[] = [
    // Left slope face (from left base edge up to ridge)
    { materialId, positions: [bl_front, bl_back, ridge_back, ridge_front] },
    // Right slope face (from right base edge up to ridge)
    { materialId, positions: [br_back, br_front, ridge_front, ridge_back] },
    // Front gable triangle
    { materialId, positions: [bl_front, ridge_front, br_front] },
    // Back gable triangle
    { materialId, positions: [br_back, ridge_back, bl_back] },
    // Bottom face
    { materialId, positions: [bl_front, br_front, br_back, bl_back] },
  ];

  return createEditableMeshFromPolygons(polygons);
}
