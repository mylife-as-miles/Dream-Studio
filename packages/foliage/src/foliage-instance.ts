import type { Vec3 } from "@blud/shared";

export type FoliageInstance = {
  id: string;
  paletteEntryId: string;
  position: Vec3;
  rotation: Vec3;
  scale: number;
};

export class FoliageInstanceStore {
  private instances: Map<string, FoliageInstance> = new Map();

  add(instance: FoliageInstance): void {
    this.instances.set(instance.id, instance);
  }

  remove(id: string): FoliageInstance | undefined {
    const inst = this.instances.get(id);
    this.instances.delete(id);
    return inst;
  }

  get(id: string): FoliageInstance | undefined {
    return this.instances.get(id);
  }

  getAll(): FoliageInstance[] {
    return Array.from(this.instances.values());
  }

  get size(): number {
    return this.instances.size;
  }

  queryRadius(center: Vec3, radius: number): FoliageInstance[] {
    const r2 = radius * radius;
    const results: FoliageInstance[] = [];
    for (const inst of this.instances.values()) {
      const dx = inst.position.x - center.x;
      const dy = inst.position.y - center.y;
      const dz = inst.position.z - center.z;
      if (dx * dx + dy * dy + dz * dz <= r2) {
        results.push(inst);
      }
    }
    return results;
  }
}
