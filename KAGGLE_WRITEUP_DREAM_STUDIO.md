# Dream Studio: AI Game Creation for Everyone

**A Gemma 4-powered browser-based creative editor that helps players, storytellers, and non-builders turn natural language into playable interactive worlds.**

**Competition track:** Digital Equity & Inclusivity  
**Supporting angle:** Future of Education  
**Team:** Miles - founder, product designer, AI engineer, full-stack builder

## Abstract

Dream Studio is a browser-based world editor and standalone game creation workspace where Gemma 4 helps close the gap between a game idea and a playable artifact. Instead of leaving creators alone with a blank engine screen, Gemma 4 reasons over the user's request, chooses from 112 structured editor tools, observes tool results, reviews screenshots, and helps produce editable 3D scenes or standalone HTML/CSS/JavaScript games. The system lets players, solo creators, storytellers, students, and other non-builders describe an idea, generate editable geometry or playable code, inspect the result, refine through natural language, and learn by studying the artifact. The goal is digital equity through creative access: lowering the barrier between imagination and interactive computing.

## Your Team

Miles - solo builder. Product design, AI workflow architecture, full-stack implementation, editor/runtime integration, documentation, and demo preparation.

## Problem Statement

Someone can spend years playing games and quietly designing their own in their head. They know the streets they want to drive through, the side quests, the characters, the weather, the jokes, the first mission, the final boss, the feeling of walking into their own version of a GTA-style city, a fantasy village, a survival island, a racing arena, or a puzzle dungeon. They know what should happen when the player opens a door, talks to an NPC, misses a jump, earns money, steals a car, solves a riddle, or wins the final challenge.

But then they open a professional game engine, and the idea often dies at the first blank project screen.

Before there is a playable prototype, there are barriers: years of programming, 3D modeling, animation, asset importing, camera control, physics, debugging, file organization, expensive assets, production planning, team coordination, funding, and hardware powerful enough to run advanced engines and 3D tools. The first lesson is not creativity. It is setup friction.

This pattern repeats quietly. A lifelong player wants to make the kind of game they have always dreamed of playing. A solo creator has a story but no programming background. A community group wants an explorable simulation but cannot hire a technical team. A modder wants to move from tweaking other people's worlds to building their own. A student or teacher may want an interactive lesson, but education is only one case inside a larger access problem. The deeper issue is that many people can imagine playable worlds, but cannot cross the production gap that turns those worlds into software.

The access gap is not only about internet connectivity. The International Telecommunication Union estimates that 2.2 billion people remain offline in 2025, and also emphasizes that affordability and digital skills are essential to meaningful connectivity [1]. Even for people who are online, advanced digital skills such as problem solving and digital content creation develop more slowly than basic use [1]. UNESCO's 2023 Global Education Monitoring Report frames technology in education around access, equity, inclusion, quality, and learner-centered use rather than technology for its own sake [2].

Game creation sits exactly at this intersection. It is one of the most powerful ways to learn computation, systems thinking, art, storytelling, simulation, and interaction design. Yet the tools are still built for people who already know how to build. The bottleneck is not imagination. The bottleneck is the translation layer between a human idea and an editable, inspectable, playable artifact.

What if a browser editor could become that translation layer? What if a non-builder could describe a world, watch it become real geometry, ask why it works, talk to characters inside it, inspect generated code, and gradually learn the craft by building?

## Overall Solution

Gemma 4 helps Dream Studio become a creative bridge for interactive worldbuilding. The system has two complementary workspaces:

1. **Copilot** edits the live 3D editor scene. It creates and refines editable worlds by calling real editor tools: geometry placement, mesh editing, materials, lights, entities, paths, gameplay hooks, behavior trees, surface authoring, and viewport screenshots.
2. **Morphus** creates standalone browser games and interactive prototypes as small web projects. It maintains files, imports assets, previews games, edits code, requests audio approval, and exports ZIP projects.

A typical workflow:

1. A creator asks: "Build a small open-world neighborhood with shops, NPCs, a delivery mission, a garage, and a night-time chase route."
2. Copilot asks Gemma 4 to plan and call editor tools.
3. Gemma 4 places rooms, lights, exhibits, NPCs, and player spawns.
4. Copilot captures a viewport screenshot so Gemma 4 can inspect scale, composition, and placement.
5. The creator asks for a playable quiz or minigame.
6. Morphus creates a multi-file HTML/CSS/JavaScript game.
7. The creator previews, edits, exports, and learns from the generated files.

The output is not a static mockup. Dream Studio produces editable scenes and runnable artifacts.

## How Gemma 4 Is Used

Gemma 4 is the default intelligence layer for the editor submission. Requests flow through `/api/copilot/generate`; the server calls `gemma-4-31b-it` through the Google GenAI SDK with:

- conversation history,
- a mode-specific system prompt,
- the relevant tool catalog,
- optional images such as viewport screenshots or reference images,
- and structured tool results from previous steps.

Gemma 4 helps Dream Studio in four core ways:

### 1. Tool-Using Editor Agent

Gemma 4 selects from `104` Copilot tools for live editor control. These tools cover scene discovery, geometry placement, mesh topology, UVs, materials, surface painting, gameplay hooks, behavior trees, paths, articulated assets, screenshots, and game sync.

This matters because Gemma 4 is not only writing a text plan for the creator. It helps perform the work by selecting actions from the editor command surface, observing structured tool results, and using those results to continue the task.

### 2. Visual Feedback Agent

Copilot includes a `capture_viewport_screenshot` tool. After meaningful scene changes, Gemma 4 can request a screenshot of the active viewport. The screenshot is attached to the next model step, allowing the model to inspect what was actually built before continuing.

The workflow becomes:

```text
plan -> call editor tools -> receive results -> capture screenshot -> inspect -> refine
```

This is essential for spatial creation. A level can be technically valid but visually wrong. Gemma 4 uses screenshot feedback to help correct layout, scale, lighting, and composition.

### 3. Standalone Game Builder

In Morphus, Gemma 4 helps creators make playable browser games. Morphus exposes `8` tools: `generate_game_html`, `morphus_list_files`, `morphus_search_files`, `morphus_read_file`, `morphus_write_file`, `morphus_create_file`, `morphus_request_delete_file`, and `morphus_request_rename_file`.

This smaller tool surface is deliberate. Morphus behaves like a coding agent inside a generated project. It searches before reading, reads bounded file slices, writes targeted changes, creates new modules only when needed, and asks before destructive file operations.

### 4. Multilingual Character and Voice Layer

Gemma 4 also powers NPC preview dialogue. A creator can define an NPC's character prompt, interact with the NPC inside the viewport, and receive in-character dialogue. Optional ElevenLabs TTS uses `eleven_multilingual_v2`, enabling multilingual voice-enabled game experiences. This is content-level multilingual support, not full UI localization yet.

## Method: Agentic Editor Architecture

The submitted editor lives in `apps/editor` and is built with React 19, TypeScript, Vite, Three.js, React Three Fiber, Rapier, Tailwind CSS, Valtio, custom Dream Studio packages, Google GenAI, Pinecone, Gemini embeddings, and ElevenLabs.

The method is deliberately not "generate one big answer." Gemma 4 helps through a bounded tool-using workflow. Each model step receives a system prompt, the conversation, the relevant tool schema, optional visual inputs, and previous tool results. The model then either answers the creator or calls tools. Dream Studio executes those tools, records the result, and gives the result back to Gemma 4 for the next step.

This creates a reproducible workflow:

```text
user goal -> Gemma 4 plan/tool call -> editor execution -> structured result
          -> optional screenshot/file read -> Gemma 4 refinement -> playable artifact
```

Key implementation files:

| System | Files |
| --- | --- |
| Gemma 4 model route | `server/copilot-generate-shared.ts`, `server/copilot-generate-api.ts`, `api/copilot/generate.ts` |
| Client provider | `src/lib/copilot/gemini-provider.ts`, `src/lib/copilot/provider.ts`, `src/lib/copilot/settings.ts` |
| Agent loop | `src/lib/copilot/agentic-loop.ts` |
| Tool catalog | `src/lib/copilot/tool-declarations.ts` |
| Tool execution | `src/lib/copilot/tool-executor.ts` |
| Mode selection | `src/app/hooks/useCopilot.ts` |
| Copilot UI | `src/components/editor-shell/CopilotPanel.tsx` |
| Morphus UI | `src/components/editor-shell/MorphusWorkspace.tsx` |
| Morphus memory | `src/lib/copilot/morphus-memory.ts` |
| NPC dialogue | `server/npc-chat-shared.ts`, `src/lib/preview-npc-chat.ts` |
| Game-code memory | `src/components/morphus-rag/RagIngestionUI.tsx`, `api/rag/upsert-game-code.ts`, `src/rag/*` |

## Tool Surface

In the submitted editor slice, Dream Studio exposes **112 structured tools**:

- **104 Copilot tools** for live 3D editor control.
- **8 Morphus tools** for standalone game-file generation and editing.

Tool categories include:

- placement and scene construction,
- transforms and selection,
- material creation and assignment,
- scene discovery and node/entity inspection,
- mesh topology editing,
- non-destructive modeling modifiers,
- UV unwraps and surface authoring,
- behavior trees,
- gameplay hooks,
- scene paths and events,
- articulated asset creation,
- viewport screenshot capture,
- Morphus file operations,
- standalone game artifact registration.

The tool design follows a principle: give Gemma 4 enough authority to act, but keep every action structured, inspectable, and bounded.

## Game-Code Memory

Dream Studio includes a Pinecone-backed game-code memory subsystem. Developers can ingest HTML, CSS, JavaScript, TypeScript, and JSON examples through the Game Code Memory admin UI. The backend chunks code, embeds it with Gemini embeddings, stores vectors in Pinecone, and formats retrieved examples as code context.

The retrieval system is designed to ground generated games in reusable patterns such as input handling, collision, cameras, UI, inventory, dialogue, enemy AI, animation, level logic, and physics.

Current status: ingestion and search APIs exist, but autonomous retrieval is not yet exposed as a first-class Morphus tool. This is documented as future work rather than overclaimed.

## Discussion: Why This Architecture Matters

A beginner does not only need a generated file. They need a loop:

- make something,
- see it,
- edit it,
- understand it,
- play it,
- repeat.

Dream Studio's architecture is built around that loop. Copilot makes spatial creation inspectable. Morphus makes code generation maintainable. Screenshots make visual verification possible. File tools make iteration safe. Tool results make Gemma 4's help visible and auditable. Together, these choices let Gemma 4 help creators move from idea to artifact inside the same workspace.

The impact is not measured only by the games Dream Studio can generate. It is measured by who gets to start. A person who has always played games but never had the team, funds, hardware, or technical vocabulary to build one can now create a scene, inspect generated logic, talk to NPCs, preview a playable result, and learn through iteration. Game creation becomes a path into creative computing instead of a wall in front of it.

## Challenges

**Scope.** Game creation spans geometry, physics, materials, behavior, audio, code, assets, UI, and export. The system needed typed tools and mode-specific prompts rather than one vague chatbot.

**Context management.** Injecting an entire scene into every prompt is brittle. Copilot instead teaches Gemma 4 to inspect progressively: settings, node lists, details, topology, materials, hooks, paths, and events only when needed.

**Visual correctness.** Spatial output must be seen. Screenshot capture became part of the model loop.

**Safe iteration.** Morphus projects become multi-file codebases. Search-first debugging, bounded reads, targeted writes, and approval-gated destructive operations prevent reckless rewrites.

## Results and Validation

Code-level validation completed during audit:

```text
npm.cmd run typecheck
npm.cmd run typecheck:orchestrator
```

Both passed.

Architecture validation from the submitted codebase:

- `gemma-4-31b-it` is configured as the default Gemma model.
- `/api/copilot/generate` routes Copilot and Morphus generation through the Gemma server path.
- `112` tools are declared in the editor tool catalog.
- Copilot and Morphus expose separate tool subsets.
- The screenshot tool returns image attachments for subsequent model steps.
- Morphus persists files and chat state in IndexedDB.
- Pinecone/Gemini embedding memory exists for game-code ingestion and search.

The important result is not a benchmark score. It is a working interaction pattern: Gemma 4 can act inside a real editor, observe the result of its actions, inspect screenshots or file slices, and continue the task without leaving the creator's workspace. That is the technical proof behind the demo.

## Limitations

Dream Studio currently uses hosted Gemma 4 rather than fully local inference. Local Ollama or llama.cpp integration is planned but should not be claimed as complete until demonstrated.

The game-code memory subsystem is implemented, but not yet fully autonomous inside Morphus. It should be described as a grounding pipeline and future first-class tool.

The editor supports multilingual prompts, NPC dialogue, and voice-enabled content, but not full editor UI localization yet.

## What's Next

1. Add local-first Gemma 4 support through Ollama or llama.cpp.
2. Expose code retrieval as a first-class Morphus tool.
3. Add education mode as a secondary track where Gemma 4 explains generated mechanics and code.
4. Add full editor localization and right-to-left UI support.
5. Publish more example projects and benchmark workflows for repeatable evaluation.

## References

[1] International Telecommunication Union, *Facts and Figures 2025*. https://www.itu.int/itu-d/reports/statistics/facts-figures-2025/

[2] UNESCO, *Global Education Monitoring Report 2023: Technology in education: A tool on whose terms?* https://www.unesco.org/gem-report/en/technology

[3] University of Minnesota Pressbooks, *Reports: Introduction to Technical and Professional Communication*. https://pressbooks.umn.edu/techwriting/chapter/4-5-reports/

[4] Miami University Howe Center for Writing Excellence, *Scientific/Technical Reports*. https://miamioh.edu/hcwe/handouts/scientific-reports/index.html

[5] Internshala Competitions, *The Gemma 4 Good Hackathon summary*. https://internshala.com/competitions/the-gemma-4-good-hackathon/
