import type { FalloffType } from "@blud/shared";
import { computeFalloff } from "./heightmap-ops.js";

/**
 * Paint a splatmap layer by increasing the weight for the selected layer
 * and proportionally decreasing other layers so per-texel weights sum to 1.0.
 *
 * The splatmap is a flat Float32Array of length resolution × resolution × layerCount.
 * For cell (i, j) and layer k, the weight is at index (i * resolution + j) * layerCount + k.
 */
export function paintSplatmapLayer(
  splatmap: Float32Array,
  resolution: number,
  layerCount: number,
  layerIndex: number,
  cx: number,
  cz: number,
  radius: number,
  strength: number,
  falloff: FalloffType
): Float32Array {
  const result = new Float32Array(splatmap);

  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(resolution - 1, Math.ceil(cx + radius));
  const minZ = Math.max(0, Math.floor(cz - radius));
  const maxZ = Math.min(resolution - 1, Math.ceil(cz + radius));

  for (let iz = minZ; iz <= maxZ; iz++) {
    for (let ix = minX; ix <= maxX; ix++) {
      const dx = ix - cx;
      const dz = iz - cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > radius) continue;

      const f = computeFalloff(dist, radius, falloff);
      const baseIndex = (iz * resolution + ix) * layerCount;

      // Increase the target layer weight
      const currentWeight = result[baseIndex + layerIndex];
      const increase = strength * f * (1 - currentWeight);
      const newWeight = Math.min(1, currentWeight + increase);
      result[baseIndex + layerIndex] = newWeight;

      // Proportionally decrease other layers so total sums to 1.0
      const otherTotal = 1 - currentWeight;
      const remainingForOthers = 1 - newWeight;

      for (let k = 0; k < layerCount; k++) {
        if (k === layerIndex) continue;
        if (otherTotal > 0) {
          result[baseIndex + k] = result[baseIndex + k] * (remainingForOthers / otherTotal);
        } else {
          // All weight was on the target layer; distribute evenly among others
          result[baseIndex + k] = remainingForOthers / (layerCount - 1);
        }
      }
    }
  }

  return result;
}
