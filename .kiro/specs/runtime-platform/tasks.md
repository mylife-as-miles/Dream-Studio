# Runtime Platform — Tasks

## Runtime Format

- [x] 1. Create `packages/runtime-format` with canonical schema types
- [x] 2. Move parse, validate, and type-guard helpers into runtime-format
- [x] 3. Add schema versioning and migration helpers
- [x] 4. Define world index and chunk metadata types
- [x] 5. Add tests for manifest parsing, validation, and backward compatibility

## Runtime Build

- [x] 6. Create `packages/runtime-build` with headless compilation
- [x] 7. Move scene compilation out of `packages/workers`
- [x] 8. Implement asset externalization and bundle packing
- [x] 9. Add world index build helpers
- [x] 10. Add CLI entrypoint for runtime builds
- [x] 11. Add CI tests for representative manifests and bundles

## Three.js Adapter

- [x] 12. Refactor `three-runtime` to depend on `runtime-format`
- [x] 13. Implement `createThreeRuntimeSceneInstance()` as primary entrypoint
- [x] 14. Make convenience loaders wrap the scene instance builder
- [x] 15. Add explicit disposal for textures, object URLs, and resources

## Gameplay Runtime

- [x] 16. Audit `gameplay-runtime` against runtime-format types
- [x] 17. Define stable adapter between runtime scene data and gameplay input

## Streaming

- [x] 18. Create `packages/runtime-streaming` for chunk orchestration
- [x] 19. Implement chunk load/unload with budgeted concurrency

## Physics

- [x] 20. Create `packages/runtime-physics-rapier` for optional Rapier bindings
- [x] 21. Implement rigid body/collider creation from physics descriptors

## Documentation

- [x] 22. Rewrite runtime docs around the new package split
- [x] 23. Add integration guides for vanilla Three and React Three Fiber
