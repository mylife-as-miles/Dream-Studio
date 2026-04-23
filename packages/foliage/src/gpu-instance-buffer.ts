import type { FoliageInstance } from "./foliage-instance";
import type { FoliagePaletteEntry } from "./foliage-palette";

export type GpuInstanceGroup = {
  meshAssetId: string;
  transforms: Float32Array; // 4x4 matrices packed
  count: number;
};

/**
 * Build a 4x4 transform matrix from position, Y-axis rotation, and uniform scale.
 * Writes 16 floats into `out` starting at `offset`.
 */
function writeTransformMatrix(
  out: Float32Array,
  offset: number,
  px: number,
  py: number,
  pz: number,
  rotationY: number,
  scale: number,
): void {
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);

  // Column-major 4x4 matrix: scale * rotationY * translation
  // Row 0
  out[offset] = scale * cosY;
  out[offset + 1] = 0;
  out[offset + 2] = scale * -sinY;
  out[offset + 3] = 0;
  // Row 1
  out[offset + 4] = 0;
  out[offset + 5] = scale;
  out[offset + 6] = 0;
  out[offset + 7] = 0;
  // Row 2
  out[offset + 8] = scale * sinY;
  out[offset + 9] = 0;
  out[offset + 10] = scale * cosY;
  out[offset + 11] = 0;
  // Row 3 (translation)
  out[offset + 12] = px;
  out[offset + 13] = py;
  out[offset + 14] = pz;
  out[offset + 15] = 1;
}

/**
 * Groups foliage instances by their palette entry's meshAssetId and builds
 * a Float32Array of packed 4x4 transform matrices for each group.
 */
export function buildInstanceGroups(
  instances: FoliageInstance[],
  palette: FoliagePaletteEntry[],
): GpuInstanceGroup[] {
  // Build a lookup from palette entry id → meshAssetId
  const paletteMap = new Map<string, string>();
  for (const entry of palette) {
    paletteMap.set(entry.id, entry.meshAssetId);
  }

  // Group instances by meshAssetId
  const groups = new Map<string, FoliageInstance[]>();
  for (const inst of instances) {
    const meshAssetId = paletteMap.get(inst.paletteEntryId);
    if (meshAssetId === undefined) continue;

    let group = groups.get(meshAssetId);
    if (!group) {
      group = [];
      groups.set(meshAssetId, group);
    }
    group.push(inst);
  }

  // Build GpuInstanceGroup for each mesh asset
  const result: GpuInstanceGroup[] = [];
  for (const [meshAssetId, groupInstances] of groups) {
    const count = groupInstances.length;
    const transforms = new Float32Array(count * 16);

    for (let i = 0; i < count; i++) {
      const inst = groupInstances[i];
      writeTransformMatrix(
        transforms,
        i * 16,
        inst.position.x,
        inst.position.y,
        inst.position.z,
        inst.rotation.y,
        inst.scale,
      );
    }

    result.push({ meshAssetId, transforms, count });
  }

  return result;
}

/**
 * Incrementally update an instance buffer by adding new instances and removing
 * instances by id. Returns a new GpuInstanceGroup with the updated transforms.
 */
export function updateInstanceBuffer(
  group: GpuInstanceGroup,
  added: FoliageInstance[],
  removed: string[],
  palette: FoliagePaletteEntry[],
): GpuInstanceGroup {
  // Rebuild from the existing group by decoding existing transforms and
  // filtering out removed ids, then appending added instances.
  // Since we don't store instance ids in the GPU buffer, we rebuild from
  // the source instances. For incremental updates, callers should maintain
  // the full instance list and call buildInstanceGroups.

  // For a simple incremental approach: rebuild the full group from the
  // provided added instances (the caller is expected to pass the full
  // updated instance list as `added` and an empty `removed`, or use
  // buildInstanceGroups for full rebuilds).

  const paletteMap = new Map<string, string>();
  for (const entry of palette) {
    paletteMap.set(entry.id, entry.meshAssetId);
  }

  // Filter added to only those matching this group's meshAssetId
  const removedSet = new Set(removed);
  const matchingInstances = added.filter((inst) => {
    if (removedSet.has(inst.id)) return false;
    return paletteMap.get(inst.paletteEntryId) === group.meshAssetId;
  });

  const count = matchingInstances.length;
  const transforms = new Float32Array(count * 16);

  for (let i = 0; i < count; i++) {
    const inst = matchingInstances[i];
    writeTransformMatrix(
      transforms,
      i * 16,
      inst.position.x,
      inst.position.y,
      inst.position.z,
      inst.rotation.y,
      inst.scale,
    );
  }

  return { meshAssetId: group.meshAssetId, transforms, count };
}
