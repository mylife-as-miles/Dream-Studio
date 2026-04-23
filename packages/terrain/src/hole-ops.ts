/**
 * Apply a hole brush to the terrain hole mask.
 * mode "hole" sets cells to 1 (invisible), "un-hole" sets cells to 0 (visible).
 */
export function applyHoleBrush(
  holeMask: Uint8Array,
  resolution: number,
  cx: number,
  cz: number,
  radius: number,
  mode: "hole" | "un-hole"
): Uint8Array {
  const result = new Uint8Array(holeMask);
  const value: 0 | 1 = mode === "hole" ? 1 : 0;

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
      result[iz * resolution + ix] = value;
    }
  }

  return result;
}
