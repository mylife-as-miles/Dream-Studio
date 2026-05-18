# Dream Studio: AI Game Creation for Everyone

**A Gemma 4-powered browser-based creative editor that helps players, storytellers, and non-builders turn natural language into playable interactive worlds.**

**Track:** Digital Equity & Inclusivity  
**Supporting angle:** Future of Education  
**Team:** Miles - founder, product designer, AI engineer, full-stack builder

## Inspiration

Most people do not lack imagination. They lack a practical path from idea to playable world.

Many people spend years playing games while quietly designing their own: an open-world neighborhood, a racing arena, a puzzle dungeon, a survival island, or a story from their culture. But turning that idea into a game usually requires programming, 3D modeling, animation, engine knowledge, debugging, assets, collaborators, money, and powerful hardware. That barrier excludes original creators before they ever make a prototype.

Dream Studio closes that creative access gap. It does not replace professional developers; it gives non-builders a working studio where they can describe a world, watch it become geometry, refine it with natural language, add characters and dialogue, and export playable prototypes. Education remains a secondary use case, not the center.

The next great game creator may not have formal training or a powerful PC. They may only have an idea. Dream Studio gives them a studio.

## What it does

Dream Studio is a browser-based 3D world editor and standalone game creation workspace powered by Gemma 4.

**Copilot** edits the live 3D editor scene. A creator can ask for a city block, skatepark, market, garage, puzzle dungeon, quest hub, racing route, or explorable learning space. Gemma 4 receives editor context, selects from structured tools, and performs real editor actions: placing geometry, creating materials, editing meshes, adding entities, creating paths, wiring gameplay hooks, authoring behavior trees, and capturing viewport screenshots to inspect what it built.

**Morphus** creates standalone HTML/CSS/JavaScript games. A creator can ask for a playable browser game, upload reference images, iterate on generated files, approve audio, preview the game, edit code, play it in the viewport, and export the project as a ZIP.

The output is not a static mockup. Gemma 4 helps inside a real creative environment: calling tools, receiving structured results, seeing screenshots, continuing iteration, and producing playable artifacts.

## How we built it

The submitted editor lives in `apps/editor`. It is built with React 19, TypeScript, Vite, Three.js, React Three Fiber, Rapier, Tailwind CSS, Valtio, custom Dream Studio editor/runtime packages, Google GenAI, Pinecone, Gemini embeddings, and ElevenLabs.

Gemma 4 is the default intelligence layer. The editor routes generation through `/api/copilot/generate`, where the server calls `gemma-4-31b-it` with the conversation history, a mode-specific system prompt, and a structured function-calling tool catalog.

The core architecture is an agentic loop:

1. The user describes what they want.
2. Dream Studio sends Gemma 4 the prompt, system instructions, previous messages, and available tools.
3. Gemma 4 returns either a final answer or one or more tool calls.
4. Dream Studio executes those tool calls against the editor or Morphus workspace.
5. Tool results are appended back into the conversation.
6. Gemma 4 continues until the task is complete.

This is the key technical idea: Gemma 4 is not only generating text. It helps by selecting actions from a real editor command surface, observing structured tool results, and using those results to continue the task.

In the submitted editor slice, Dream Studio exposes **112 structured tools** to the AI system:

- **104 Copilot tools** for live 3D editor control.
- **8 Morphus tools** for standalone game-file generation and editing.

Copilot tools cover placement, transforms, scene inspection, material creation, lighting, entity creation, scene paths, gameplay hooks, behavior trees, mesh topology, UV/surface authoring, LOD/bake metadata, viewport screenshot capture, game sync, and Articraft articulated assets.

Morphus tools cover project registration and file operations: `generate_game_html`, file listing, bounded file reads, search, write, create, and approval-gated delete/rename requests.

The two-toolspace design matters. Copilot needs broad spatial authority because it edits a 3D scene graph. Morphus needs disciplined file operations because it behaves like a coding agent maintaining a playable web project.

### Visual verification

Game creation is spatial, so text feedback is not enough. Copilot has a `capture_viewport_screenshot` tool that captures the active editor viewport and attaches the image to the next model step. This lets Gemma 4 inspect layout, scale, lighting, and placement before continuing.

The workflow becomes:

`plan -> call editor tools -> inspect results -> capture screenshot -> refine -> preview/play`

That makes the model behave more like a human creator: build, look, adjust.

### Morphus workflow

Morphus creates multi-file web games rather than one giant HTML blob. It prefers `index.html`, focused JavaScript modules, CSS, and project-relative assets. Files and chat state are stored in IndexedDB. The UI includes a file explorer, code editor, imports, image assets, audio approval, preview, and ZIP export.

Follow-up edits are treated like software maintenance. Morphus searches before reading, reads bounded slices, writes targeted changes, and requests approval before destructive file operations. A read budget prevents endless scanning and nudges the model toward focused edits.

### Game-code memory

Dream Studio also includes a Pinecone-backed game-code memory subsystem. Developers can ingest HTML, CSS, JavaScript, TypeScript, and JSON examples through the Game Code Memory admin UI. The backend chunks code, embeds it with Gemini embeddings, stores vectors in Pinecone, and formats retrieved examples as code context for Gemma 4.

This subsystem is designed to ground generation in reusable game patterns such as input handling, collision, camera systems, UI, inventory, dialogue, enemy AI, animation, level logic, and physics. The next milestone is exposing retrieval as a first-class Morphus tool so Gemma 4 can autonomously search prior examples before generating or debugging.

### Multilingual and voice-enabled creation

Dream Studio supports multilingual creation at the content layer. Gemma 4 can receive multilingual prompts and generate NPC dialogue through the NPC chat route. The NPC preview overlay sends player dialogue to Gemma 4, receives in-character responses, and can speak them using ElevenLabs. The default TTS model is `eleven_multilingual_v2`, enabling multilingual voice-enabled NPC experiences.

## Challenges we ran into

The first challenge was scope. A real game editor has geometry, materials, entities, physics, behavior, paths, runtime export, audio, generated code, and preview. A normal chatbot would not survive that complexity. We solved this with typed tools and a mode-specific system prompt.

The second challenge was context. Injecting the entire scene into every prompt would be expensive and brittle. Instead, Gemma 4 is taught to inspect progressively: scene settings first, then node lists, node details, entities, materials, topology, paths, hooks, or events only when needed.

The third challenge was visual correctness. A scene can be structurally valid but visually wrong. Screenshot capture made visual verification part of the loop.

The fourth challenge was safe iteration in Morphus. Generated projects become multi-file codebases. Morphus uses search-first debugging, bounded reads, targeted writes, local memory, and approval gates so follow-up prompts improve the existing project instead of replacing it.

## Accomplishments that we're proud of

I am proud that Gemma 4 helps inside a real creative environment. It can build, inspect, edit, and refine instead of merely describing what a user should do.

I am proud of the scale and specificity of the tool surface: 112 declared tools, including 104 live editor tools across worldbuilding, mesh modeling, gameplay authoring, behavior logic, surface work, and verification.

I am also proud of the two-workspace design. Copilot is for live 3D worldbuilding. Morphus is for standalone playable browser games. Both use Gemma 4, but each has the right boundaries for its job.

## What we learned

AI creative tools need structured agency. A model becomes much more useful when it can call tools, observe results, and iterate inside the same workspace as the user.

We also learned that accessibility does not mean removing power. Dream Studio still exposes real geometry tools, mesh operations, materials, behaviors, and code. The difference is that non-builders can enter through natural language and learn by inspecting the artifact Gemma 4 helps them create.

Dream Studio's impact is not measured only by the games it can generate. It is measured by who gets to start. A player who would normally stop at an idea can now build a scene, inspect generated logic, talk to NPCs, preview a playable result, and learn through iteration. Game creation becomes a path into creative computing instead of a wall in front of it.

## What's next for Dream Studio

Next, I want to add deeper local-first Gemma 4 support through Ollama or llama.cpp so creators can build privately with limited connectivity.

I also want to make game-code memory a first-class Morphus tool, expand multilingual support into full editor localization, and add an optional education mode where Gemma 4 explains mechanics and generated code as it builds.

The long-term goal is simple: make interactive creation accessible to anyone with an idea.

## Reproducibility notes

Key files:

- `apps/editor/src/lib/copilot/settings.ts`
- `apps/editor/server/copilot-generate-shared.ts`
- `apps/editor/src/lib/copilot/agentic-loop.ts`
- `apps/editor/src/lib/copilot/tool-declarations.ts`
- `apps/editor/src/lib/copilot/tool-executor.ts`
- `apps/editor/src/app/hooks/useCopilot.ts`
- `apps/editor/src/components/editor-shell/MorphusWorkspace.tsx`
- `apps/editor/src/lib/copilot/morphus-memory.ts`
- `src/rag` and `apps/editor/api/rag`

Verification:

- `npm.cmd run typecheck`
- `npm.cmd run typecheck:orchestrator`

Both passed.
