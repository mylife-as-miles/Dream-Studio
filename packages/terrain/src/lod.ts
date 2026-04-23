import type { EditableMesh, Vec3 } from "@blud/shared";
import { generateTerrainMesh } from "./terrain-mesh-gen.js";

/**
 * Downsample a heightmap by half, averaging 2x2 blocks.
 */
function downsampleHeightmap(heightmap: Float32Array, resolution: number): { heightmap: Float32Array; resolution: number } {
  const newRes = Math.max(2, Math.ceil(resolution / 2));
  const result = new Float32Array(newRes * newRes);

  for (let iz = 0; iz < newRes; iz++) {
    for (let ix = 0; ix < newRes; ix++) {
      // Map back to source coordinates
      const srcX = Math.min((ix / (newRes - 1)) * (resolution - 1), resolution - 1);
      const srcZ = Math.min((iz / (newRes - 1)) * (resolution - 1), resolution - 1);

      const x0 = Math.floor(srcX);
      const z0 = Math.floor(srcZ);
      const x1 = Math.min(x0 + 1, resolution - 1);
      const z1 = Math.min(z0 + 1, resolution - 1);

      const fx = srcX - x0;
      const fz = srcZ - z0;

      // Bilinear interpolation
      const h00 = heightmap[z0 * resolution + x0];
      const h10 = heightmap[z0 * resolution + x1];
      const h01 = heightmap[z1 * resolution + x0];
      const h11 = heightmap[z1 * resolution + x1];

      result[iz * newRes + ix] = h00 * (1 - fx) * (1 - fz) + h10 * fx * (1 - fz) + h01 * (1 - fx) * fz + h11 * fx * fz;
    }
  }

  return { heightmap: result, resolution: newRes };
}

/**
 * Downsample a hole mask by half. A cell is a hole if any of the source cells are holes.
 */
function downsampleHoleMask(holeMask: Uint8Array, resolution: number, newRes: number): Uint8Array {
  const result = new Uint8Array(newRes * newRes);

  for (let iz = 0; iz < newRes; iz++) {
    for (let ix = 0; ix < newRes; ix++) {
      const srcX = Math.min(Math.floor((ix / (newRes - 1)) * (resolution - 1)), resolution - 1);
      const srcZ = Math.min(Math.floor((iz / (newRes - 1)) * (resolution - 1)), resolution - 1);
      const x1 = Math.min(srcX + 1, resolution - 1);
      const z1 = Math.min(srcZ + 1, resolution - 1);

      if (
        holeMask[srcZ * resolution + srcX] === 1 ||
        holeMask[srcZ * resolution + x1] === 1 ||
        holeMask[z1 * resolution + srcX] === 1 ||
        holeMask[z1 * resolution + x1] === 1
      ) {
        result[iz * newRes + ix] = 1;
      }
    }
  }

  return result;
}

/**
 * Generate an array of EditableMesh at progressively reduced resolutions.
 * Each LOD level halves the resolution of the previous level.
 *
 * @param heightmap - The full-resolution heightmap
 * @param resolution - The heightmap resolution (resolution × resolution grid)
 * @param size - World extents (width, maxHeight, depth)
 * @param lodLevels - Number of LOD levels to generate
 * @param holeMask - Optional hole mask
 * @returns Array of EditableMesh, one per LOD level (index 0 = highest detail)
 */
export function generateLodMeshes(
  heightmap: Float32Array,
  resolution: number,
  size: Vec3,
  lodLevels: number,
  holeMask?: Uint8Array
): EditableMesh[] {
  const meshes: EditableMesh[] = [];

  let currentHeightmap = heightmap;
  let currentResolution = resolution;
  let currentHoleMask = holeMask;

  for (let lod = 0; lod < lodLevels; lod++) {
    meshes.push(generateTerrainMesh(currentHeightmap, currentResolution, size, currentHoleMask));

    if (lod < lodLevels - 1 && currentResolution > 2) {
      const downsampled = downsampleHeightmap(currentHeightmap, currentResolution);
      currentHoleMask = currentHoleMask
        ? downsampleHoleMask(currentHoleMask, currentResolution, downsampled.resolution)
        : undefined;
      currentHeightmap = downsampled.heightmap;
      currentResolution = downsampled.resolution;
    }
  }

  return meshes;
}
