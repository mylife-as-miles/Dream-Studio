import type { FalloffType } from "@blud/shared";

/**
 * Compute a falloff multiplier based on distance from brush center.
 * Returns a value in [0, 1] where 1 = full effect and 0 = no effect.
 */
export function computeFalloff(distance: number, radius: number, falloff: FalloffType): number {
  if (distance >= radius) return 0;
  const t = distance / radius;
  switch (falloff) {
    case "constant":
      return 1;
    case "linear":
      return 1 - t;
    case "smooth":
      // Hermite smoothstep: 3t² - 2t³
      return 1 - (t * t * (3 - 2 * t));
    default:
      return 1 - t;
  }
}

/**
 * Iterate over all heightmap cells within the brush radius and invoke a callback.
 * cx, cz are in grid-space coordinates (0..resolution-1).
 */
function forEachInRadius(
  resolution: number,
  cx: number,
  cz: number,
  radius: number,
  callback: (index: number, falloffValue: number, ix: number, iz: number) => void,
  falloff: FalloffType
): void {
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
      callback(iz * resolution + ix, f, ix, iz);
    }
  }
}

/**
 * Raise heightmap values within the brush radius.
 */
export function applyRaiseBrush(
  heightmap: Float32Array,
  resolution: number,
  cx: number,
  cz: number,
  radius: number,
  strength: number,
  falloff: FalloffType
): Float32Array {
  const result = new Float32Array(heightmap);
  forEachInRadius(resolution, cx, cz, radius, (index, f) => {
    result[index] += strength * f;
  }, falloff);
  return result;
}

/**
 * Lower heightmap values within the brush radius.
 */
export function applyLowerBrush(
  heightmap: Float32Array,
  resolution: number,
  cx: number,
  cz: number,
  radius: number,
  strength: number,
  falloff: FalloffType
): Float32Array {
  const result = new Float32Array(heightmap);
  forEachInRadius(resolution, cx, cz, radius, (index, f) => {
    result[index] -= strength * f;
  }, falloff);
  return result;
}

/**
 * Flatten heightmap values toward a target height within the brush radius.
 */
export function applyFlattenBrush(
  heightmap: Float32Array,
  resolution: number,
  cx: number,
  cz: number,
  radius: number,
  strength: number,
  falloff: FalloffType,
  targetHeight: number
): Float32Array {
  const result = new Float32Array(heightmap);
  forEachInRadius(resolution, cx, cz, radius, (index, f) => {
    const current = result[index];
    result[index] = current + (targetHeight - current) * strength * f;
  }, falloff);
  return result;
}

/**
 * Smooth heightmap values by averaging neighbors within the brush radius.
 */
export function applySmoothBrush(
  heightmap: Float32Array,
  resolution: number,
  cx: number,
  cz: number,
  radius: number,
  strength: number,
  falloff: FalloffType
): Float32Array {
  const result = new Float32Array(heightmap);
  forEachInRadius(resolution, cx, cz, radius, (index, f, ix, iz) => {
    // Average the 3x3 neighborhood
    let sum = 0;
    let count = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = ix + dx;
        const nz = iz + dz;
        if (nx >= 0 && nx < resolution && nz >= 0 && nz < resolution) {
          sum += heightmap[nz * resolution + nx];
          count++;
        }
      }
    }
    const avg = sum / count;
    result[index] = heightmap[index] + (avg - heightmap[index]) * strength * f;
  }, falloff);
  return result;
}

/**
 * Add procedural noise to heightmap values within the brush radius.
 * Uses a simple pseudo-random hash for deterministic noise per cell.
 */
export function applyNoiseBrush(
  heightmap: Float32Array,
  resolution: number,
  cx: number,
  cz: number,
  radius: number,
  strength: number,
  falloff: FalloffType
): Float32Array {
  const result = new Float32Array(heightmap);
  forEachInRadius(resolution, cx, cz, radius, (index, f, ix, iz) => {
    // Simple hash-based noise in [-1, 1]
    const hash = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
    const noise = (hash - Math.floor(hash)) * 2 - 1;
    result[index] += noise * strength * f;
  }, falloff);
  return result;
}

/**
 * Quantize heightmap values to discrete steps within the brush radius.
 */
export function applyTerraceBrush(
  heightmap: Float32Array,
  resolution: number,
  cx: number,
  cz: number,
  radius: number,
  strength: number,
  falloff: FalloffType,
  stepHeight: number
): Float32Array {
  const result = new Float32Array(heightmap);
  if (stepHeight <= 0) return result;
  forEachInRadius(resolution, cx, cz, radius, (index, f) => {
    const current = result[index];
    const quantized = Math.round(current / stepHeight) * stepHeight;
    result[index] = current + (quantized - current) * strength * f;
  }, falloff);
  return result;
}

/**
 * Simple hydraulic erosion simulation within the brush radius.
 * Smooths peaks and deepens valleys by moving height from higher to lower neighbors.
 */
export function applyErosionBrush(
  heightmap: Float32Array,
  resolution: number,
  cx: number,
  cz: number,
  radius: number,
  strength: number,
  falloff: FalloffType
): Float32Array {
  const result = new Float32Array(heightmap);

  // Collect affected cells
  const affected: Array<{ index: number; f: number; ix: number; iz: number }> = [];
  forEachInRadius(resolution, cx, cz, radius, (index, f, ix, iz) => {
    affected.push({ index, f, ix, iz });
  }, falloff);

  // For each affected cell, move material toward the lowest neighbor
  for (const { index, f, ix, iz } of affected) {
    let lowestHeight = heightmap[index];
    let lowestIdx = index;

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nx = ix + dx;
        const nz = iz + dz;
        if (nx >= 0 && nx < resolution && nz >= 0 && nz < resolution) {
          const ni = nz * resolution + nx;
          if (heightmap[ni] < lowestHeight) {
            lowestHeight = heightmap[ni];
            lowestIdx = ni;
          }
        }
      }
    }

    if (lowestIdx !== index) {
      const diff = heightmap[index] - lowestHeight;
      const transfer = diff * strength * f * 0.5;
      result[index] -= transfer;
      result[lowestIdx] += transfer;
    }
  }

  return result;
}
