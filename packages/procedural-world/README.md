# Procedural World

Dream Studio's WebGPU procedural-world package is a direct, adapted port of
LAAS / `fable5-world-demo` at commit
`fd75fdb718996908aad3d22b59dfa297dc94298d`.

It owns world generation, GPU resources, and the LAAS render stack. The host
owns the canvas, renderer, camera lifecycle, and animation loop. See
`docs/LAAS_PORT_ARCHITECTURE.md` for the migration map and license details.
