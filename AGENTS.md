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
  index.ts              # library entry — re-exports core/* + KonvaRenderer + KonvaGraphRenderer
  KonvaRenderer.vue     # top-level component, own & provide Workspace
  core/                 # plain TS model: Workspace, Node, Edge, Group, SubGraph, Executor, CoordSystem
  renderer/             # Konva rendering: KonvaGraphRenderer, InteractionManager, ContextMenuBuilder, types
  hooks/                # Vue composables: useWorkspace, useCoordSystem, useWorkspaceEvent, useContextMenuState
  components/           # Vue components: ContextMenu.vue, WorkspaceToolbar.vue
  handles/              # handle rendering components
test/                   # mirrors src/ structure
```

### Core → Vue boundary

- `src/core/` **must have zero Vue imports** — no `reactive`, `shallowRef`, `toValue`, etc.

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
