# AGENTS.md

## Commands

Root scripts (bun workspace monorepo):

```bash
bun dev              # start playground (= bun run --filter playground dev)
bun test             # vitest run in all @0x-jerry/* packages
bun play:build       # build playground for production
```

Per-package — use `bun run --filter <pkg>`:

```bash
bun run --filter @0x-jerry/golden-graph test          # core tests
bun run --filter @0x-jerry/golden-graph-backend test   # backend tests
bun run --filter @0x-jerry/golden-graph-renderer test  # renderer tests
bun run --filter @0x-jerry/golden-graph check          # core typecheck (tsc)
bun run --filter @0x-jerry/golden-graph-backend check  # backend typecheck (tsc)
bun run --filter @0x-jerry/golden-graph-renderer check # renderer typecheck (vue-tsc)
bun run --filter @0x-jerry/golden-graph build          # core build (tsdown)
bun run --filter @0x-jerry/golden-graph-backend build  # backend build (tsdown)
bun run --filter @0x-jerry/golden-graph-renderer build # renderer build (vite)
```

Single test file or filter by name (from package directory or via filter):

```bash
bun vitest run packages/core/test/Workspace.test.ts
bun vitest run -t "should add node"
```

**No root `bun build` or `bun check`** — run per-package.

## Monorepo structure

```
packages/
  core/        → @0x-jerry/golden-graph          plain TS model, zero Vue imports
  backend/     → @0x-jerry/golden-graph-backend  WorkflowExecutor, worker host
  renderer/    → @0x-jerry/golden-graph-renderer Konva + Vue components, hooks, composables
  playground/  → playground (private)            dev app, not published
```

Dependency direction: `renderer` → `core`, `backend` → `core`, `playground` → all three. Workspace links via `workspace:*`.

## Architecture

- **core** is pure TS — `Workspace`, `Node`, `Edge`, `Group`, `SubGraph`, `NodeSchema`, `Executor` (facade), `ExecutorBackend` (protocol), `CoordSystem`. No Vue, no DOM.
- **backend** owns node definitions (`INodeDefinition = { schema, execute }`) and the `WorkflowExecutor` engine. Imports core types only.
- **renderer** has `KonvaRenderer.vue` (top-level, provides `Workspace`), `KonvaGraphRenderer`, `InteractionManager`, `ContextMenuBuilder`, Vue composables in `hooks/`, and UI components in `components/`.
- Execution protocol is plain JSON (`ExecutorBackendRequest` / `ExecutorBackendResponse` in core). Frontend never executes; backend walks snapshots.
- Subgraph interface nodes (`subgraph.input` / `subgraph.output`) are core-owned schemas, auto-registered by `Workspace`.
- Execute functions must be worker-safe (no DOM); handle values must be structured-cloneable.

## Code conventions

- **oxfmt** formatter (`.oxfmtrc.json`): no semicolons, single quotes, trailing commas, arrow parens always, 80 char width
- **2-space indent**, LF line endings (`.editorconfig`)
- `verbatimModuleSyntax: true` — enums are runtime values: import with `import`, not `import type`. Interfaces/types use `import type`.
- `noUnusedLocals: true`, `noUnusedParameters: true` — compiler errors on dead code
- `noUncheckedIndexedAccess: true` — `arr[0]` returns `T | undefined`, null check required
- `_` prefixed methods/properties are private — never access from outside the class
- Test files import `describe`/`it`/`expect` explicitly despite `globals: true`
- `tsconfig` includes `"types": ["bun"]` — `Bun` globals available in source

## Build & test details

- **core** and **backend** build with `tsdown` (not Vite)
- **renderer** builds with `vite build` (lib mode, ESM) + `vite-plugin-dts`
- Tests: core/backend use `edge-runtime` environment; renderer uses `jsdom`
- CI runs `bun run test` on tag push; GH Pages deploys `packages/playground/dist` on push to `main`
- Releasing: push a `v*` tag, `changelogithub` generates release notes

## provide/inject via `defineContext`

Uses `@0x-jerry/vue-kit`'s `defineContext`:

- `useWorkspace()` = **inject only** — returns `undefined` if no ancestor provided
- `useWorkspace.provide()` = **create + provide** — runs the factory, calls `provide()`, returns the value

Root component (`KonvaRenderer.vue`) calls `.provide()`; children call the bare function.
