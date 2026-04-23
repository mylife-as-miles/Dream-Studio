import type { EditableMesh, Vec3 } from "@blud/shared";
import { vec3 } from "@blud/shared";
import { createEditableMeshFromPolygons, type EditableMeshPolygon } from "@blud/geometry-kernel";

/**
 * Generate a terrain mesh from a heightmap.
 *
 * Creates a grid of vertices from the heightmap and builds quad faces.
 * Cells where holeMask is 1 are skipped (holes in the terrain).
 *
 * The world-space position of cell (i, j) is:
 *   x = (j / (resolution - 1)) * size.x - size.x / 2
 *   y = heightmap[i * resolution + j] * size.y
 *   z = (i / (resolution - 1)) * size.z - size.z / 2
 */
export function generateTerrainMesh(
  heightmap: Float32Array,
  resolution: number,
  size: Vec3,
  holeMask?: Uint8Array
): EditableMesh {
  const polygons: EditableMeshPolygon[] = [];
  const halfX = size.x / 2;
  const halfZ = size.z / 2;

  for (let iz = 0; iz < resolution - 1; iz++) {
    for (let ix = 0; ix < resolution - 1; ix++) {
      // Check if any corner of this cell is a hole
      if (holeMask) {
        const i00 = iz * resolution + ix;
        const i10 = iz * resolution + (ix + 1);
        const i01 = (iz + 1) * resolution + ix;
        const i11 = (iz + 1) * resolution + (ix + 1);
        if (holeMask[i00] === 1 || holeMask[i10] === 1 || holeMask[i01] === 1 || holeMask[i11] === 1) {
          continue;
        }
      }

      // Four corners of the quad
      const x0 = (ix / (resolution - 1)) * size.x - halfX;
      const x1 = ((ix + 1) / (resolution - 1)) * size.x - halfX;
      const z0 = (iz / (resolution - 1)) * size.z - halfZ;
      const z1 = ((iz + 1) / (resolution - 1)) * size.z - halfZ;

      const y00 = heightmap[iz * resolution + ix] * size.y;
      const y10 = heightmap[iz * resolution + (ix + 1)] * size.y;
      const y01 = heightmap[(iz + 1) * resolution + ix] * size.y;
      const y11 = heightmap[(iz + 1) * resolution + (ix + 1)] * size.y;

      // Create a quad as a polygon (counter-clockwise winding when viewed from above)
      polygons.push({
        id: `terrain:${ix}:${iz}`,
        positions: [
          vec3(x0, y00, z0),
          vec3(x1, y10, z0),
          vec3(x1, y11, z1),
          vec3(x0, y01, z1),
        ],
      });
    }
  }

  return createEditableMeshFromPolygons(polygons);
}
