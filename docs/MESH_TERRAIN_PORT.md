# Mesh Terrain Port

Audit of `vibe-stack/super-terrain` ("Mesh Terrain Lab") and the record of what was
taken from it into this monorepo, what was left behind, and why.

The upstream checkout used for the port sits at `vendor/super-terrain` and is
gitignored. It is a read-only reference; nothing in it is built or shipped.

## What upstream is

A browser-first partitioned mesh-terrain editor modelled on Unreal Engine 5.8's
Mesh Terrain architecture. Roughly 46,000 lines under `src/terrain`, running on
Three.js `WebGPURenderer` through React Three Fiber. It has no WebGL fallback,
by explicit design.

The claim that matters is in its README: it is *not* a single heightmap mesh. The
demo world is a sparse 4 km x 4 km logical terrain with sculpt layers,
weight-painted materials, editable topology, live add/subtract CSG, local density
control, tunnel interiors, five geometric LODs, worker compilation, bounded
residency, and IndexedDB persistence.

Module sizes at the commit audited:

| Area | LOC |
|---|---|
| `rendering/` | 11,616 |
| `compiler/` | 6,748 |
| `modifiers/` | 4,440 |
| `rocks/` | 3,944 |
| `react/` | 3,225 |
| `demo/` | 2,873 |
| `export/` | 1,887 |
| `mesh/` | 1,530 |
| `workers/` | 1,163 |
| everything else | ~8,500 |

## Why a mesh terrain at all

This repo already had heightmap terrain: `@blud/terrain`'s `heightmap-ops`,
`splatmap-ops`, `hole-ops`, `terrain-mesh-gen`, `lod`, `terrain-spline` — 866
lines, and, before this work, unused by the editor. It also already had a
`TerrainNode` in the scene graph with no renderer, tools, or inspector behind it.

A heightmap stores one elevation per column. That is cheap to store, cheap to
sample, and cannot express an overhang, an arch, a cave, or an undercut, because
those need two surfaces above the same ground position. Holes can only be masked
out of the grid, which removes triangles but cannot produce an interior.

Mesh terrain answers exactly that: strokes follow the picked surface normal
rather than world Y, so a stroke can push into X/Z, and holes are cut by exact
CSG rather than masked. The two representations are complementary and both are
kept. `TerrainNodeData.mode` selects between them and defaults to `"heightmap"`
when absent, so existing documents load unchanged.

## What was ported

The authoring core, ~5,700 lines, into `packages/terrain/src/mesh-terrain/`:

- `core/` — AABB and bounds maths, world/section coordinates, buffer pool, assert
- `mesh/` — `TerrainMesh` (the editable sectioned mesh), spatial index, validation
- `modifiers/` — the non-destructive stack, the brush kernel (9 sculpt modes),
  stroke sampling, transforms, swept tunnels, factories
- `modifiers/boolean/` — `CutterVolume`, the `three-bvh-csg` backend, cutter
  displacement
- `lod/LodSelector`, `materialSettings` (4 paint channels), `config`

The brush kernel is the single definition of what one dab does; both the
authoritative evaluation and the live viewport preview call it, which is what
keeps the preview honest about what will be compiled.

## What was deliberately not ported

- **`rendering/`** — upstream's WebGPU material, lighting and post stack. It
  duplicates and conflicts with `@blud/render-pipeline`. We render ported terrain
  through our own pipeline instead.
- **`compiler/`, `workers/`, `streaming/`, `partition/` residency** — upstream's
  worker compilation and bounded-residency streaming. Our editor evaluates a
  bounded region synchronously. This is the largest functional gap: very large
  worlds will not stream the way upstream's do.
- **`persistence/`** — IndexedDB world storage. Our terrain lives in the scene
  document, which has its own save path.
- **`rocks/`, `water/`, `demo/`, `prebake/`, `export/`** — world dressing and the
  demo app, not authoring.
- **`packages/clustered-webgpu-lighting`** — upstream's own workspace package,
  part of the rendering stack we did not take.

## Adaptations made during the port

Each of these was a forced change, not a preference:

- **`EditableMesh` renamed to `TerrainMesh`.** `@blud/geometry-kernel` already
  exports an unrelated `EditableMesh` used by the mesh-edit tools. Two different
  things under one name would have collided at every editor import site.
- **`unionBounds` renamed to `unionCutterBounds`** in `CutterVolume`. Upstream has
  two functions of that name with different signatures — one in `core/bounds`
  taking two AABBs, one in `CutterVolume` taking an array — and already aliased
  the second at every call site. Re-exporting both from one barrel made the
  clash explicit.
- **`terrainAssert` no longer reads `import.meta.env.DEV` directly.** That only
  exists under Vite. As a library we cannot assume a bundler, so the flag is
  resolved defensively and defaults to off in an unknown host.
- **`WorldProfile` inlined into `config.ts`.** It is a two-member union that lived
  in the height-field compiler, which is not part of this port.
- **`three-bvh-csg@0.0.18` added** to `@blud/terrain` for live CSG. `three` here is
  0.184.0 against upstream's 0.185.1.

## Type ownership

The modifier stack is described twice, on purpose.

`packages/shared/src/terrain-document.ts` owns the **document** shape — material
channels, cutter volumes, the `TerrainModifier` union, `MeshTerrainState` — because
a scene file has to describe its terrain without depending on the code that
evaluates it. `packages/terrain/src/mesh-terrain/modifiers/types.ts` owns the
**implementation** shape, kept in upstream's file layout so the port stays
diffable against upstream.

TypeScript is structural, so the two interoperate with no conversion at the
boundary — but only while they actually match, and nothing would catch a field
added on one side alone. That failure would surface as terrain silently dropping
part of a saved stack. `mesh-terrain/document-compat.ts` asserts the two are
mutually assignable, so drift becomes a build error instead.

The surface itself is never stored. It is the deterministic replay of the
modifier stack over the base field described by `seed` and `profile`. That is what
keeps edits non-destructive and the document small no matter how much sculpting
it carries, and it is why modifier `sequence` is load-bearing rather than
cosmetic: a stroke records its dabs against the surface as it stood when it was
drawn, so replaying it against a different surface is not the same edit.

## Known gaps

- No streaming or worker compilation; evaluation is synchronous over a bounded
  region.
- No IndexedDB persistence layer; terrain rides the scene document.
- Upstream's rendering quality — its clustered WebGPU lighting, its material
  stack — is not reproduced.
- `three` version skew (0.184.0 vs upstream 0.185.1) is unaudited for behavioural
  differences in the CSG and BVH paths.
