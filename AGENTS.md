# AGENTS.md

## Commands

```bash
pnpm dev            # start playground
pnpm test           # vitest run (single-run)
pnpm test:watch     # vitest watch mode
pnpm test:coverage  # vitest + coverage output
pnpm build          # vite build (lib mode, ESM)
pnpm check          # vue-tsc --noEmit (typecheck)
```

Run a single test file or filter by name:

```bash
pnpm vitest run test/core/Workspace.test.ts
pnpm vitest run -t "should add node"
```

## Tech stack

- **TypeScript** + **Vue 3** (SFC `.vue` files)
- **pnpm** workspace: root library + `playground/` sub-package
- **Vite** lib build (ESM output to `dist/`), `vite-plugin-dts` with `rollupTypes: true` rolls types into `dist/index.d.ts`
- **Vitest** with `jsdom` environment, `globals: true`
- **vue-tsc** for typechecking (`pnpm check`)

## Architecture

- Library entry: `src/index.ts` — re-exports `src/core/` + `GraphRenderer.vue`
- `src/core/` — model layer: `Workspace`, `Node`, `Edge`, `Group`, `SubGraph`, `Executor`, `Interactive`, `CoordSystem`
- `src/handles/` — Vue components for node handle types (text, number, select, display)
- `src/hooks/` — Vue composables (`useNode`, `useEdge`, `useConnectionGesture`, etc.)
- Tests at `test/` mirror the `src/` structure

## Code conventions

- **No semicolons**, **single quotes**, **trailing commas**, **arrow parens always**
- **2-space indent**, LF line endings — enforced by `.editorconfig`
- `verbatimModuleSyntax: true` — must use `import type` for type-only imports
- `noEmit: true` in tsconfig (Vite handles emit; types via `vite-plugin-dts`)
- Methods and properties prefixed with `_` are private — never access them from outside the class; add a public method instead
- Test files import `describe`/`it`/`expect` explicitly (Vitest globals are configured but imports are still used for clarity)

## Repo-specific notes

- The `playground` is a pnpm workspace package; `pnpm dev` proxies to `npm run dev -C playground`
- GitHub Pages deploys `playground/dist` on push to `main`
- CI runs `pnpm run test:coverage` and uploads to Codecov
- Releasing: push a `v*` tag, `changelogithub` generates the release notes
