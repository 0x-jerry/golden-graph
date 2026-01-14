# @0x-jerry/golden-graph

A TypeScript + Vue 3 library for executable node graphs.

Provides:
- `Workspace`: model for nodes, edges, groups, and execution
- `GraphRenderer`: Vue component for rendering and interaction

Supports dragging, connecting, selection, grouping, execution, and includes a playground example.

## Installation

```bash
npm install @0x-jerry/golden-graph
# or
pnpm add @0x-jerry/golden-graph
```

## Quick Start

Use in a Vue 3 app:

```ts
import { GraphRenderer, type Workspace } from '@0x-jerry/golden-graph'

function setupWorkspace(ws: Workspace) {
}
```

```vue
<GraphRenderer :setup="setupWorkspace" />
```

See the `playground` directory for a more complete example.

## Scripts

- `npm run dev`: start the playground
- `npm run test`: run Vitest tests
- `npm run build`: build the library
