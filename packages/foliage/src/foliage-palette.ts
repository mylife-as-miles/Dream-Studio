export type FoliagePaletteEntry = {
  id: string;
  name: string;
  meshAssetId: string;
  minScale: number;
  maxScale: number;
  density: number;
  alignToNormal: boolean;
  randomRotationY: boolean;
  minSlopeAngle: number;
  maxSlopeAngle: number;
};

export function createDefaultFoliagePaletteEntry(
  id: string,
  name: string,
  meshAssetId: string,
): FoliagePaletteEntry {
  return {
    id,
    name,
    meshAssetId,
    minScale: 0.8,
    maxScale: 1.2,
    density: 1.0,
    alignToNormal: true,
    randomRotationY: true,
    minSlopeAngle: 0,
    maxSlopeAngle: 90,
  };
}
