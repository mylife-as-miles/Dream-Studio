# Reze Studio — Requirements

## Overview

Reze Studio is an additional studio application in the BLUD monorepo that integrates the Reze Engine for extended game development capabilities.

## Functional Requirements

### FR-1: Reze Engine Integration

- FR-1.1: Integrate `reze-engine` as the core runtime dependency
- FR-1.2: Provide a studio interface for Reze Engine content authoring
- FR-1.3: Support project creation and management within the studio

### FR-2: UI

- FR-2.1: Built with React 18, Tailwind CSS, and Radix UI primitives
- FR-2.2: Use class-variance-authority and tailwind-merge for component styling
- FR-2.3: Provide Lucide icons for UI elements

### FR-3: Development

- FR-3.1: Run dev mode via `vite --port 8082`
- FR-3.2: Build as a static Vite app
- FR-3.3: Operate as a standalone app within the monorepo

## Non-Functional Requirements

### NFR-1: Independence

- NFR-1.1: Does not depend on BLUD editor-core or geometry-kernel packages
- NFR-1.2: Uses its own engine (`reze-engine`) separate from the BLUD runtime stack
- NFR-1.3: Can be developed and deployed independently of other BLUD apps
