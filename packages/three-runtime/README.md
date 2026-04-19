# @blud/three-runtime

Three.js adapter for Web Hammer runtime content.

`@blud/three-runtime` no longer owns the runtime format or build pipeline.

Package split:

- `@blud/runtime-format`: runtime contracts, parsing, validation, migration
- `@blud/runtime-build`: `.whmap` compilation, asset externalization, bundle packing
- `@blud/three-runtime`: Three object creation and scene instances
- `@blud/runtime-streaming`: optional chunk/world orchestration
- `@blud/runtime-physics-rapier`: optional Rapier bindings

## Install

```bash
bun add @blud/three-runtime three
```

## Host Ownership

The Three adapter does not own:

- renderer creation
- main loop
- camera policy
- input
- physics stepping
- chunk streaming policy
- gameplay systems

It gives you Three objects and helpers. Your application decides what to do with them.

## Load A Runtime Scene Instance

```ts
import { Scene } from "three";
import {
  createThreeAssetResolver,
  createThreeRuntimeSceneInstance,
  parseWebHammerEngineBundleZip
} from "@blud/three-runtime";

const response = await fetch("/levels/tutorial.runtime.zip");
const zipBytes = new Uint8Array(await response.arrayBuffer());
const bundle = parseWebHammerEngineBundleZip(zipBytes);
const assetResolver = createThreeAssetResolver(bundle);

const threeScene = new Scene();
const instance = await createThreeRuntimeSceneInstance(bundle.manifest, {
  applyToScene: threeScene,
  lod: {
    lowDistance: 30,
    midDistance: 10
  },
  resolveAssetUrl: ({ path }) => assetResolver.resolve(path)
});

threeScene.add(instance.root);
```

The instance returns:

- `root`
- `nodesById`
- `lights`
- `physicsDescriptors`
- `entities`
- `scene`
- `dispose()`

## Compatibility Loader

If you still want the old convenience surface, `loadWebHammerEngineScene()` remains available and now wraps `createThreeRuntimeSceneInstance()`.

## Lower-Level Object Factory

```ts
import { createThreeRuntimeObjectFactory } from "@blud/three-runtime";

const factory = createThreeRuntimeObjectFactory(scene, {
  lod: {
    lowDistance: 30,
    midDistance: 10
  },
  resolveAssetUrl: ({ path }) => `/assets/${path}`
});

const nodeObject = await factory.createNodeObject(scene.nodes[0]);
const instancingObjects = await factory.createInstancingObjects();
```

## World Settings

```ts
import {
  applyRuntimeWorldSettingsToThreeScene,
  clearRuntimeWorldSettingsFromThreeScene
} from "@blud/three-runtime";

await applyRuntimeWorldSettingsToThreeScene(threeScene, {
  settings: runtimeScene.settings
});

clearRuntimeWorldSettingsFromThreeScene(threeScene);
```

## Bundles Vs Manifests

- `.whmap`: authored editor source
- `scene.runtime.json`: stable runtime manifest
- `scene.runtime.zip`: transport bundle for quick validation, handoff, or small levels

For production worlds, prefer unpacked manifests plus normal asset hosting and optional chunk streaming.

## Vanilla Three Integration

Recommended stack:

1. Build runtime artifacts with `@blud/runtime-build`.
2. Parse or fetch runtime manifests with `@blud/runtime-format`.
3. Instantiate Three content with `@blud/three-runtime`.
4. Add physics with `@blud/runtime-physics-rapier` if needed.
5. Add streaming with `@blud/runtime-streaming` if your world is chunked.

## React Three Fiber Integration

The same package split applies in R3F:

1. Load manifests or bundles outside the render tree.
2. Build a Three runtime scene instance.
3. Mount `instance.root` into your R3F scene graph or mirror its contents into declarative components.
4. Keep physics, gameplay, and streaming host-owned.
