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

Playground has **no `check` script** — typecheck it directly (vue-tsc is fetched via bunx, it is not in playground devDeps):

```bash
cd packages/playground && bunx vue-tsc --noEmit
```

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
- `_` prefixed members are private-by-convention: intra-package code may touch them (e.g. `SubGraph` reads `workspace._nodeRegister`, `VirtualWorkspace` copies `ws._idGenerator.current()`), but extension code must use public APIs (`addNode`, `queryEdges`, `registerNodeSchema`, `nextId`)
- Connection rules (`NodeHandle.canConnectTo`): same position or same node → blocked; `'*'` on either side → allowed; otherwise type-set intersection decides
- Enums are runtime numbers (JSON-safe, needed for schema round-trips): `HandlePosition None=0/Left=1/Right=2`, `NodeType None=0/Entry=1`, `ActiveType None=0/Node=1/Group=2/Edge=3`
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

## Adding a node

Node definitions are owned by the **backend/playground**, not the renderer:

```ts
export interface INodeDefinition {
  schema: INodeSchema // JSON-safe, survives JSON round-trip
  execute?: (ctx: NodeExecutionContext) => unknown | Promise<unknown>
}
```

- `INodeSchema` fields: `type` (optional on authored schemas — auto-generated as `id ? \`${id}.${key}\` : key` when registered via a provider; required for direct `registerNodeSchema`), `name` (header + "Add Node" menu label), `description?`, `internal?` (hidden from menu), `nodeType?` (`NodeType.Entry = 1` marks execution start), `handles: INodeHandleConfig[]`
- `INodeHandleConfig` fields: `key` (unique within node, required for `getData`), `accepts` (data type(s) for connection matching, `'*'` = anything), `type` (render component: `'text' | 'number' | 'select' | 'image' | 'display'`, registered in renderer `handles/index.ts`), `name` (label; empty name reserves no fixed column), `position` (`Left` = input, `Right` = output, `None` = layout-only row), `value` (initial), `options` (render props; select choices come from `options.options`)
- `ctx.getData(key)` resolves inputs through incoming edges; `ctx.setData(key, value)` writes run state and streams a `handle-updates` event to the frontend
- `execute` runs **in a Web Worker** — no DOM; handle values must be structured-cloneable. `execute` is optional (Entry sources / Display sinks can omit it)

Registration flow: `packages/playground/src/nodes/index.ts` provider array → worker entry `new ExecutorWorkerHost()` + `host.addProviders(nodeProviders)` → frontend `await workspace.loadNodeProvidersFromBackend()` → `registerNodeProvider` stamps `type` and builds a render-only `Node` subclass per schema; the "Add Node" menu groups nodes by `provider.name`. Minimal example (mirror `packages/playground/src/nodes/math/Op.ts`):

```ts
import { HandlePosition } from '@0x-jerry/golden-graph'
import type { INodeProvider } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'

export const addDefinition: INodeDefinition = {
  schema: {
    name: 'Math - Add', // `type` is omitted — derived from provider id + key
    handles: [
      { key: 'a', name: 'A', position: HandlePosition.Left, accepts: 'number', value: 0 },
      { key: 'b', name: 'B', position: HandlePosition.Left, accepts: 'number', value: 0 },
      { key: 'out', name: 'Sum', position: HandlePosition.Right, accepts: 'number', value: 0 },
    ],
  },
  execute: (ctx) => {
    const a = ctx.getData<number>('a') ?? 0
    const b = ctx.getData<number>('b') ?? 0
    ctx.setData('out', a + b)
  },
}

export const mathNodeProvider: INodeProvider<INodeDefinition> = {
  id: 'Math',
  name: 'Math',
  nodes: { Add: addDefinition }, // type auto-generated as `Math.Add`
}
```

Then add the provider to the `nodeProviders` array in `nodes/index.ts`. No renderer changes needed unless you add a new `options.type`.

## Auto-layout

Pure-TS module in **renderer** (`packages/renderer/src/layout/`), no external deps, works on `Workspace` public APIs:

- `computeNodePositions(nodes, edges, options): LayoutResult` — pure, returns a `Map<nodeId, pos>` + bounding `rect`; never mutates.
- `autoLayout(ws, options)` — applies via `node.moveTo(x, y)` (each emits `node:changed` → renderer redraws) then re-fits every group to its children (40/50 padding, mirroring `GroupManager.addGroup`). No-op while `ws.disabled`.
- `resolveEdgeDirection(edge)` — infers producer→consumer from handle position (`isRight` → `isLeft`); `edge.start/end` order is unreliable. Same-side edges contribute **no** rank constraint but still join weakly-connected components.
- Algorithm: weakly-connected components → longest-path-from-root rank assignment (cycle-safe) → barycenter crossing reduction → coordinate assignment. `direction: 'right'` (default; inputs left → outputs right) or `'down'`. `measure` supplies per-node `{width,height}` (renderer passes `getNodeWidth`/`getNodeHeight`); default estimator mirrors `LAYOUT`.
- Exposed as the **"Auto Layout"** item in `ContextMenuBuilder.canvasMenu`, gate by `ws.disabled`.
- `KonvaGraphRenderer` auto-lays-out a newly created subgraph's inner workspace via a `subgraph:added` listener (`autoLayoutSubGraph`, default on; disable with `{ autoLayoutSubGraph: false }`).

## Renderer (Konva + Vue)

- **Layer order** (bottom → top): grid → groups → edges → nodes. The rubber-band selection rect is drawn into the node layer so it stays visible (`InteractionManager` takes a `nodeLayer`).
- **Workspace events drive rendering** — all mutations flow through workspace APIs → typed `ws.events` → renderer; there is no direct model↔Konva sync. `KonvaGraphRenderer._subscribe` listens to `node:added/removed/changed`, `edge:added/removed`, `group:added/removed/changed`, `coord:changed`, `state:changed`, `executor:changed`, `handle:updated`, `handle:connection-changed` — all wrapped in a `Disposable`.
- **View classes own all render state.** Entity renderers are classes extending `EntityView<T>` that hold their Konva group and child views: `NodeView` (owns its `HandleView`s via `_handleViews`, caches `_body/_header/_name/_resize` refs, exposes `setActive`/`setExecuteHighlight`), `EdgeView` (caches `_line/_closeBtn`), `GroupView` (caches `_body/_header/_name/_resize`), `HandleView` (owns `_joint/_label/_content/_module`). `KonvaGraphRenderer` is a thin orchestrator: it owns the stage/layers, registers ws events in `_subscribe`, delegates view mutations to `EntityViewStore` (the `_nodeViews/_edgeViews/_groupViews: Map<number, View>` registry + full render/destroy) and state projections to `GraphStateSyncer` (coord/selection/executor/handle). Pure geometry helpers (`getJointPos`, `getHandleIndex`, `computeNodeHeight`, `bezierOffset`) stay as module functions. The corner resize grip (shared `ResizeHandle` in `components/ResizeHandle.ts`) is drawn per node **and** per group, shown only while selected.
- **Group interactions**: double-click a group header/name opens an inline rename `Input` (with `onStopEdit`; `GroupView.startRename` adds it to the group's Konva group and `GroupView._stopRename` destroys it when the edit session ends, with cleanup on view destroy); dragging the group corner grip resizes it via `GroupResizeGesture` (clamped to `GROUP_MIN_WIDTH/HEIGHT`).
- **`ATTR.ELEMENT_ID`** stores node id on node groups, group id on group groups, edge id on edge groups, and **handle key** on handle groups. `InteractionManager._hitTarget` / `getJointInfo` read it for hit-testing.
- **Handle modules** (`renderer/handles/`): each file exports a `NodeHandleFactory` object (`type` string + `config` + `create(handle, options): NodeHandleModule` + optional `dispose()`). `create` returns a **fresh module instance per handle** — a class extending `Konva.Group` (the module IS its content group), so per-handle state lives on the instance fields (no `WeakMap` keyed by group). Modules may implement `update()` / override `destroy()` for cleanup. Factories are registered via `HandleComponentRegistry` in `handles/index.ts`, resolved by `getHandleFactory(options.type)`. `HandleView` creates/destroys these per-handle and is registered in a module `WeakMap<NodeHandle, HandleView>` (see `getHandleView` / `setJointHighlight`) used for connection-drag hit-testing.
- **Form elements** (`renderer/components/`): `FormElement extends Konva.Group` — `_activate()` binds a **window keydown** listener and registers as the stage's active element; `deactivate()` is the idempotent full teardown; `destroy()` calls `deactivate()` then `super.destroy()`. `Input` uses a singleton `HiddenInput` positioned over the stage container; key handling in `input/keyboard.ts` via `InputKeyEnv = { sync, blink, commit, cancel, clearHidden }` — Enter → `commit()`, Escape → `cancel()`, IME composition is ignored (`e.isComposing || e.keyCode === 229`).
- **Cursor on hover**: Konva v10 ignores the shape `cursor` config, so hover cursors are set on the shared stage container via `renderer/cursor.ts` — `setStageCursor(node, cursor)` / `resetStageCursor(node)` resolve the stage from any Konva node. Used by the resize grip (`ResizeHandle`, `nwse-resize`; released on `visibleChange`/`mouseout`/destroy) and the image handle (`ImageHandle`, `pointer` over the image/placeholder). Since the stage container is shared, any cursor-setting element must clear the cursor on `mouseout` and on destroy.
- **Coord transform**: stage scale = `coord.scale`; stage x/y = `coord.origin * scale`; use `coord.convertScreenCoord` / `convertToScreenCoord` for pointer↔workspace math.
- **Edges** are cubic beziers (`clamp(dx/2, 10, 200)` control offset, `hitStrokeWidth: 20`) with a close button at the midpoint (`EdgeView`).

## Executor protocol (plain JSON)

**Full reference: [`docs/protocol.md`](./docs/protocol.md).** All messages are plain JSON, defined in `core/src/ExecutorBackend.ts`.

- Frontend → backend: `{ type: 'execute', req: ExecuteRequest }` | `{ type: 'list-node-providers' }`. Backend → frontend: `progress` | `handle-updates` | `finish` (with `error?`) | `node-providers`.
- `ExecuteRequest = { snapshot: IWorkspace; entryNodeIds: number[]; debug: boolean }` — the backend walks the snapshot directly, no `Workspace` instance.
- Backend contract: `getNodeProviders()`, `execute(req, onEvent)` (resolves when all events delivered, rejects on failure), optional `dispose()`.
- Node schemas are served as `INodeProvider<INodeSchema>` (`id`, `name`, `nodes: Record<key, schema>`); node `type` is derived as `id ? \`${id}.${key}\` : key`. Subgraph interface nodes (`subgraph.input`/`subgraph.output`) are core-side, not served.
- `WorkerLike` / `WorkerScopeLike` are structural subsets of the DOM worker types — keeps backends testable in jsdom and in-process.
- `WorkflowExecutor` is stack-based from entry nodes, re-queuing until all upstream nodes processed; **diff cache keyed by node id** (ids are stable across snapshots) — a node re-runs only when its fully-resolved data changed; `MAX_ITERATIONS = 100_000` loop guard; debug mode sleeps 100 ms per changed node; unknown node types throw at runtime (subgraph interface nodes excluded); nested subgraphs get lazy child executors with silent events.

## Ids & data

- Node/edge/group ids start at 1 (`createIncrementIdGenerator`), persist in `toJSON` via `extra.incrementID`, and are **stable across snapshots** — the backend diff cache relies on this.
- `Node.toJSON().data` = structuredClone of real (non-edge-resolved) values.
- `Node.size` is optional (`0`/missing = auto): the renderer's `getNodeWidth` falls back to `LAYOUT.NODE_WIDTH`, `getNodeHeight` never goes below the content height (header + handle rows). `node.setSize({ x, y })` emits `node:changed`; right-side joints, labels, edge attach points (`getJointPos`) and handle content widths all follow `node.size.x`. A corner resize grip is rendered per-node and shown only while selected (`NodeView.setActive`), driven by `DRAG_TYPE.RESIZE` in `InteractionManager`, which baselines from the effective `getNodeWidth`/`getNodeHeight` so an auto-sized node grows immediately on drag.
- `ws.events.on(...)` returns an unsubscribe fn — feed it into a `Disposable`.

## Tests

- Environments: core/backend `edge-runtime`, renderer `jsdom`. Tests import `describe`/`it`/`expect` explicitly. Renderer tests that construct Konva shapes rely on jsdom's native `canvas` package support (installed as a devDependency) for real 2D contexts.
- Backend test builders (`WorkflowExecutor.test.ts`): `node(id, type, data?, extra?)`, `edge(from, to)` (auto ids), `graph(partial)` (fills defaults), `createExecutor(collected)` captures progress/updates.
- `DirectExecutorBackend` (test helper) runs `WorkflowExecutor` in-process and structuredClones payloads like the worker transport; `WorkerExecutor.test.ts` builds in-process `WorkerScopeLike`/`WorkerLike` loopbacks.

## Pitfalls

- **Dispose ordering**: the renderer must unsubscribe before `ws.dispose()` tears down the emitter and terminates the worker — `KonvaRenderer.vue` disposes the renderer in `onBeforeUnmount`, before `useWorkspace.provide()`'s `onUnmounted(ws.dispose)` runs.
- `Workspace.disabled` = `state.disabled || executorState.isProcessing` — gate UI during runs.
- Keyless/position-less handles are legal (render as layout-only rows after positioned ones) but only one per node is safe (key defaults to `''`).
- `addNode(type)` throws when the type is not registered; `setData` on a stale key only warns.
- Playground save/load (`App.vue`) does `ws.clear()` + `await nextTick()` before `fromJSON` so the Konva stage clears first; auto-run skips events while `ws.executorState.isProcessing` (executor back-writes must not re-trigger runs).
- The `NodeHandle` doc comment mentions `getHandleComponent()` — the real renderer function is `getHandleFactory()`.
