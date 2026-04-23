import type { ControlPoint, Vec3 } from "@blud/shared";

/**
 * Compute the closest point on a line segment (a→b) to point p.
 * Returns the distance from p to the closest point and the height at that point.
 */
function closestPointOnSegment(
  p: { x: number; z: number },
  a: Vec3,
  b: Vec3
): { distance: number; height: number } {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const apx = p.x - a.x;
  const apz = p.z - a.z;
  const abLenSq = abx * abx + abz * abz;

  if (abLenSq === 0) {
    const dx = p.x - a.x;
    const dz = p.z - a.z;
    return { distance: Math.sqrt(dx * dx + dz * dz), height: a.y };
  }

  const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / abLenSq));
  const closestX = a.x + t * abx;
  const closestZ = a.z + t * abz;
  const closestY = a.y + t * (b.y - a.y);

  const dx = p.x - closestX;
  const dz = p.z - closestZ;
  return { distance: Math.sqrt(dx * dx + dz * dz), height: closestY };
}

/**
 * Evaluate a cubic Bezier segment at parameter t.
 */
function evaluateBezierSegment(p0: Vec3, p0Out: Vec3, p1In: Vec3, p1: Vec3, t: number): Vec3 {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p0Out.x + 3 * u * t * t * p1In.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * p0Out.y + 3 * u * t * t * p1In.y + t * t * t * p1.y,
    z: u * u * u * p0.z + 3 * u * u * t * p0Out.z + 3 * u * t * t * p1In.z + t * t * t * p1.z,
  };
}

/**
 * Sample a spline defined by control points into a polyline of world-space positions.
 */
function sampleSplinePolyline(controlPoints: ControlPoint[], samplesPerSegment = 16): Vec3[] {
  if (controlPoints.length < 2) {
    return controlPoints.map((cp) => cp.position);
  }

  const points: Vec3[] = [];

  for (let i = 0; i < controlPoints.length - 1; i++) {
    const cp0 = controlPoints[i];
    const cp1 = controlPoints[i + 1];

    // Bezier control points: P0, P0+outTangent, P1+inTangent, P1
    const p0 = cp0.position;
    const p0Out = {
      x: p0.x + cp0.outTangent.x,
      y: p0.y + cp0.outTangent.y,
      z: p0.z + cp0.outTangent.z,
    };
    const p1 = cp1.position;
    const p1In = {
      x: p1.x + cp1.inTangent.x,
      y: p1.y + cp1.inTangent.y,
      z: p1.z + cp1.inTangent.z,
    };

    const steps = samplesPerSegment;
    for (let s = 0; s <= (i === controlPoints.length - 2 ? steps : steps - 1); s++) {
      const t = s / steps;
      points.push(evaluateBezierSegment(p0, p0Out, p1In, p1, t));
    }
  }

  return points;
}

/**
 * Apply spline deformation to a heightmap.
 *
 * Flattens/carves the heightmap along the spline path within a corridor width.
 * Returns both the modified heightmap and a copy of the original for undo support.
 *
 * @param heightmap - The source heightmap
 * @param resolution - Grid resolution
 * @param size - World extents (width, maxHeight, depth)
 * @param controlPoints - Spline control points
 * @param corridorWidth - Width of the deformation corridor in world units
 * @param embedDepth - Vertical offset below the spline for river-style carving
 * @returns Object with modified and original heightmaps
 */
export function applySplineDeformation(
  heightmap: Float32Array,
  resolution: number,
  size: Vec3,
  controlPoints: ControlPoint[],
  corridorWidth: number,
  embedDepth: number
): { modified: Float32Array; original: Float32Array } {
  const original = new Float32Array(heightmap);
  const modified = new Float32Array(heightmap);

  const halfX = size.x / 2;
  const halfZ = size.z / 2;
  const halfCorridor = corridorWidth / 2;

  // Sample the spline into a polyline
  const polyline = sampleSplinePolyline(controlPoints);

  if (polyline.length < 2) {
    return { modified, original };
  }

  // For each heightmap cell, find the closest point on the polyline
  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      const worldX = (ix / (resolution - 1)) * size.x - halfX;
      const worldZ = (iz / (resolution - 1)) * size.z - halfZ;

      let minDist = Infinity;
      let splineHeight = 0;

      // Check distance to each segment of the polyline
      for (let s = 0; s < polyline.length - 1; s++) {
        const result = closestPointOnSegment(
          { x: worldX, z: worldZ },
          polyline[s],
          polyline[s + 1]
        );
        if (result.distance < minDist) {
          minDist = result.distance;
          splineHeight = result.height;
        }
      }

      if (minDist <= halfCorridor) {
        const index = iz * resolution + ix;
        // Compute blend factor: full effect at center, fading at edges
        const t = minDist / halfCorridor;
        const blend = 1 - t * t; // Quadratic falloff

        // Target height: spline height minus embed depth, normalized by size.y
        const targetNormalized = (splineHeight - embedDepth) / size.y;
        const currentNormalized = modified[index];

        modified[index] = currentNormalized + (targetNormalized - currentNormalized) * blend;
      }
    }
  }

  return { modified, original };
}
