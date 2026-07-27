# AGENTS.md

## Commands

```bash
bun dev            # start playground
bun test           # vitest run (single-run)
bun test:watch     # vitest watch mode
bun test:coverage  # vitest + coverage output
bun build          # vite build (lib mode, ESM → dist/)
bun check          # vue-tsc --noEmit (typecheck)
```

Run a single test file or filter by name:

```bash
bun vitest run test/core/Workspace.test.ts
bun vitest run -t "should add node"
```

## Tech stack

- **TypeScript** + **Vue 3** (SFC `.vue` files)
- **bun** runtime + package manager, pnpm workspace: root library + `playground/` sub-package
- **Vite** lib build (ESM output to `dist/`), `vite-plugin-dts` generates type declarations
- **Vitest** with `jsdom` environment, `globals: true`
- **Konva** for canvas rendering in `src/renderer/`
- **vue-tsc** for typechecking (`bun check`)

## Architecture

```
src/
  index.ts              # library entry — re-exports core/* + backend/* + KonvaRenderer + KonvaGraphRenderer
  KonvaRenderer.vue     # top-level component, own & provide Workspace
  core/                 # plain TS model: Workspace, Node, Edge, Group, SubGraph, NodeSchema, Executor (facade), ExecutorBackend (protocol), CoordSystem
  backend/              # execution side: WorkflowExecutor (JSON-native engine), WorkerExecutorBackend (main-thread driver), ExecutorWorkerHost (worker-side endpoint)
  renderer/             # Konva rendering: KonvaGraphRenderer, InteractionManager, ContextMenuBuilder, types
  hooks/                # Vue composables: useWorkspace, useCoordSystem, useWorkspaceEvent, useContextMenuState
  components/           # Vue components: ContextMenu.vue, WorkspaceToolbar.vue
  handles/              # handle rendering components
test/                   # mirrors src/ structure; test/helpers/ holds shared test utilities
```

### Core → Vue boundary

- `src/core/` **must have zero Vue imports** — no `reactive`, `shallowRef`, `toValue`, etc.
- `src/backend/` may import from `src/core/`, never the reverse (core only references the `ExecutorBackend` *interface*, which lives in `src/core/ExecutorBackend.ts`).

### Node definitions & execution

High-level data flow (every hop is plain JSON):

```
[backend: node definitions { schema, execute }]
        │ getNodeSchemas() ── JSON ──▶
[frontend: registerNodeSchema() → generic render-only nodes; user builds the graph]
        │ execute(): ExecuteRequest{ snapshot, entryNodeIds, debug } ── JSON ──▶
[backend: WorkflowExecutor walks the snapshot JSON directly]
        │ progress / handle-updates / finish ── JSON ──▶
[frontend: mirrors progress + applies writes via node.setData()]
```

- **The backend owns node definitions** — `INodeDefinition = { schema: INodeSchema, execute }` (`src/backend/WorkflowExecutor.ts`). The schema is the JSON node shape (type, name, handles, nodeType); the execute function receives a minimal `NodeExecutionContext` (`getData` resolves inputs through edges, `setData` writes outputs).
- **The frontend never executes.** `Executor` (core) is only a facade: re-entrancy guard, `executor:changed` state, applying streamed writes. `ws.execute()` throws when no backend is configured. Schema-registered nodes carry no execute logic.
- Setup flow: `new Workspace({ executorBackend })` → `await ws.loadNodeSchemasFromBackend()` → add nodes by type.
- The protocol (`ExecutorBackendRequest` / `ExecutorBackendResponse` in `src/core/ExecutorBackend.ts`) is plain JSON, so any out-of-process backend (any language, e.g. over WebSocket) can implement it. `WorkflowExecutor`'s semantics are the reference contract to replicate: stack traversal with dependency re-queuing, input resolution through edges, a diff cache keyed by node id (per graph level), subgraph expansion (inject `subgraph.input` values by `Name`, run nested workspace, read `subgraph.output` `Value`s back), debug pacing.
- `WorkerExecutorBackend` + `ExecutorWorkerHost` (in `src/backend/`) are the reference backend: the host holds the definitions, serves schemas, and runs `WorkflowExecutor` on each snapshot — **no `Workspace` mirror**. Nested subgraph workspaces get lazily-created child executors, each with its own diff cache.
- Subgraph interface nodes (`subgraph.input` / `subgraph.output`) are core-owned schemas (`subGraphInputNodeSchema` / `subGraphOutputNodeSchema` in `src/core/SubGraph.ts`), auto-registered by every `Workspace`.
- Constraints: execute functions must be worker-safe (no DOM) and handle values must be structured-cloneable.
- Worker entry files are consumer-side (the library can't bundle consumer node code): `new ExecutorWorkerHost(nodeDefinitions)`.

### Context menu flow

1. `InteractionManager` detects right-click target → `_resolveContextTarget()` returns `ContextMenuContext`
2. `_handleContextMenu()` calls `onContextMenu(ctx, pointerEvent, buildDefaultContextMenu(ctx, ws))`
3. `KonvaRenderer.vue` receives it and calls `useContextMenuState().show(x, y, menus)`
4. Context menu UI is separate from core — all menu building logic lives in `renderer/`

## provide/inject via `defineContext`

Uses `@0x-jerry/vue-kit`'s `defineContext`:

```ts
const useWorkspace = defineContext(key, factory)
```

- `useWorkspace()` = **inject only** — returns `undefined` if no ancestor provided
- `useWorkspace.provide()` = **create + provide** — runs the factory, calls `provide()`, returns the value

**Root component must call `.provide()`.** Children call the bare function.

```ts
// KonvaRenderer.vue (root)
const ws = useWorkspace.provide()   // creates Workspace, provides to subtree

// WorkspaceToolbar.vue (child)
const ws = useWorkspace()           // injects from parent
```

## Code conventions

- **No semicolons**, **single quotes**, **trailing commas**, **arrow parens always**
- **2-space indent**, LF line endings — enforced by `.editorconfig`
- `verbatimModuleSyntax: true` — **enums are runtime values**: import with `import`, not `import type`. Interfaces/types use `import type`.
- `noEmit: true` in tsconfig (Vite handles emit; types via `vite-plugin-dts`)
- `noUnusedLocals: true`, `noUnusedParameters: true` — compiler errors on dead code
- `noUncheckedIndexedAccess: true` — `arr[0]` returns `T | undefined`, null check required
- `_` prefixed methods/properties are private — never access from outside the class
- Test files import `describe`/`it`/`expect` explicitly (Vitest globals are configured but imports are still used for clarity)
- `tsconfig` includes `"types": ["bun"]` — `Bun` globals are available in source

## Repo-specific notes

- `bun dev` proxies to `bun run --cwd playground dev`
- The `playground` is a pnpm workspace package
- GitHub Pages deploys `playground/dist` on push to `main`
- CI runs `bun run test:coverage` and uploads to Codecov
- Releasing: push a `v*` tag, `changelogithub` generates the release notes
