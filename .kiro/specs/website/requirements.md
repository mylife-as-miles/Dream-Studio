# Website — Requirements

## Overview

The BLUD website serves as the public-facing documentation and onboarding site for the framework. It provides guides, API references, and getting-started content for developers adopting BLUD.

## Functional Requirements

### FR-1: Documentation

- FR-1.1: Host runtime and package documentation
- FR-1.2: Provide integration guides for vanilla Three.js and React Three Fiber
- FR-1.3: Document the distinction between `.whmap`, runtime manifest, and runtime bundle
- FR-1.4: Provide a host-ownership guide explaining what BLUD runtime does and does not own

### FR-2: Onboarding

- FR-2.1: Provide a getting-started guide with clone, install, and run instructions
- FR-2.2: Explain the orchestrator workflow and individual app dev modes
- FR-2.3: Provide quick-start examples for common use cases

### FR-3: Site Infrastructure

- FR-3.1: Built with Vite + React + TypeScript
- FR-3.2: Styled with Tailwind CSS and Space Grotesk font
- FR-3.3: Deployable as a static site
- FR-3.4: Run dev mode via `bun run dev:website`

## Non-Functional Requirements

### NFR-1: Content

- NFR-1.1: Keep documentation in sync with the `docs/` folder in the monorepo
- NFR-1.2: Package-specific docs live in `packages/*/README.md` and are referenced from the site
