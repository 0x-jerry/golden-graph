# AGENTS.md

Bun workspace monorepo. No root `bun build`/`bun check` — run per-package with `bun run --filter <pkg> test|check|build`. Scripts per package in each `packages/*/package.json`.

```bash
bun run dev            # start playground
bun run test           # vitest run in all @0x-jerry/* packages
bun run play:build     # build playground
bun vitest run <file>  # single test file (-t "name" to filter)
```

`packages/renderer` and `packages/playground` pin `typescript` to the `typescript-native-bridge` fork in devDeps — do not remove, it fixes their `vue-tsc` `check`.

## Layout

```
packages/
  protocol/  → JSON protocol types + docs/protocol.md        (pure TS)
  core/      → Workspace/Node/Edge/Group/SubGraph model       (pure TS)
  backend/   → node definitions + WorkflowExecutor             (pure TS)
  renderer/  → Konva + Vue components, hooks                  (Vue)
  playground/→ dev app, private, not published
```

Dependency direction: `core` → `protocol`, `backend` → `core`+`protocol`, `renderer` → `core`, `playground` → all.

## Conventions

- oxfmt — config in `.oxfmtrc.json` (no semicolons, single quotes, trailing commas, parens always, 80 col); 2-space indent, LF.
- `_`-prefixed = private-by-convention: intra-package may touch, extension code uses public APIs.
- Enums are runtime numbers (see `packages/protocol/src/`); connection rules in `packages/core/src/NodeHandle.ts:131` (`canConnectTo`).

## Source of truth — read these, don't duplicate

- **Executor protocol** → `packages/protocol/docs/protocol.md` (messages, snapshot shapes, diff cache, debug, `MAX_ITERATIONS`, lifecycle). Wire types in `packages/protocol/src/ExecutorBackend.ts`.
- **`INodeDefinition` / `NodeExecutionContext`** → `packages/backend/src/WorkflowExecutor.ts` (doc comments at the types).
- **Adding a node** → model `packages/playground/src/nodes/math/Op.ts`; register in `packages/playground/src/nodes/index.ts`.
- **Auto-layout** → `packages/renderer/src/layout/` (`engine.ts` pure pipeline, `index.ts` `autoLayout`, `types.ts` options). Exposed via `ContextMenuBuilder.ts`; subgraph auto-layout in `KonvaGraphRenderer.ts`.
- **Renderer internals** → `packages/renderer/src/renderer/`:
  - `EntityView.ts` + `NodeView.ts`/`EdgeView.ts`/`GroupView.ts`/`HandleView.ts` (views own render state)
  - `EntityViewStore.ts` (view registry), `GraphStateSyncer.ts` (state projection)
  - `handles/types.ts` + `handles/index.ts` (handle factory registry)
  - `components/FormElement.ts`, `components/input/` (keyboard/IME in `Input.ts`), `cursor.ts` (Konva v10 ignores shape cursor — set on stage container)
  - Layer order, coord transform, edge geometry: read the code.
- **provide/inject** → `hooks/useWorkspace.ts` (`defineContext`): `useWorkspace()` injects, `.provide()` creates+provides; `KonvaRenderer.vue` provides.
- **Ids stable across snapshots** (`extra.incrementID`) — backend diff cache depends on it. See `core/src/helper.ts`.
- **Tests** → `packages/backend/test/` builders (`node`/`edge`/`graph`/`createExecutor`), `DirectExecutorBackend` helper, `WorkerExecutor.test.ts`.

## Pitfalls

- **Dispose ordering**: renderer unsubscribes before `ws.dispose()` — `KonvaRenderer.vue` disposes in `onBeforeUnmount` before the provider's `onUnmounted(ws.dispose)`.
- `Workspace.disabled` = `state.disabled || executorState.isProcessing` — gate UI during runs.
- Only one keyless/position-less handle per node is safe (key defaults to `''`).
- `addNode(type)` throws on unregistered type; `setData` on stale key only warns.
- Playground save/load: `ws.clear()` + `await nextTick()` before `fromJSON`.
- `NodeHandle` doc comment says `getHandleComponent()` — real fn is `getHandleFactory()`.
