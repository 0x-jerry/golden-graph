# Backend ↔ Core protocol

This document is the authoritative reference for every protocol between the
core (`@0x-jerry/golden-graph`) and the backend
(`@0x-jerry/golden-graph-backend`). Types are defined in
`packages/protocol/src/ExecutorBackend.ts`, `packages/protocol/src/types.ts`,
`packages/protocol/src/NodeSchema.ts` and `packages/protocol/src/NodeProvider.ts`.

## 1. Overview & invariants

The core and the backend talk over a **plain-JSON message protocol**. There is
no shared object graph across the boundary — every message payload must survive
a `JSON.parse(JSON.stringify(...))` (equivalently: a `structuredClone`) round
trip.

Invariants that the whole protocol is built on:

- **Core never executes** — workflows always run on the backend. The frontend
  renders the graph, sends a snapshot, and applies the values the backend
  streams back.
- **Backend never renders** — it walks the snapshot directly and has no
  `Workspace`/`Node` instances. Node shapes come from the schemas it serves via
  `getNodeProviders()`.
- **Node/edge/group ids are stable across snapshots** (`extra.incrementID` in
  the snapshot). The backend's diff cache is keyed by node id and relies on
  this.
- **Enums are numbers** (JSON-safe): `HandlePosition` `None=0/Left=1/Right=2`,
  `NodeType` `None=0/Entry=1`.
- **Execute functions are worker-safe** — no DOM access. Handle values written
  during execution must be structured-cloneable.

## 2. Transport layers

The protocol is transport-agnostic. Three layers share the same message shapes:

| Layer | Core side | Backend side | Notes |
| --- | --- | --- | --- |
| In-process | `ExecutorBackend` interface | `WorkflowExecutor` (via `DirectExecutorBackend` test helper) | Direct method calls; payloads are structured-cloned to mimic real transport. |
| Web Worker | `WorkerExecutorBackend` | `ExecutorWorkerHost` | `postMessage` payloads are exactly the `ExecutorBackendRequest` / `ExecutorBackendResponse` unions. |
| Any out-of-process channel | any `ExecutorBackend` impl | any process (any language) | Implement the same JSON unions over e.g. WebSocket. |

### The `ExecutorBackend` contract (in-process)

```ts
interface ExecutorBackend {
  /** All node providers (id + name + schemas) this backend defines. */
  getNodeProviders(): Promise<INodeProvider<INodeSchema>[]>

  /** Run a workflow. Resolves after the run finished; rejects on failure. */
  execute(req: ExecuteRequest, onEvent: (e: ExecutorBackendEvent) => void): Promise<void>

  /** Tear down (e.g. terminate the worker). */
  dispose?(): void
}
```

`execute()` resolves **only after all events for the run were delivered** and
rejects when the run failed. Transports may consume the `finish` event
internally to settle that promise.

### Worker transport specifics

- `WorkerLike` (frontend side) and `WorkerScopeLike` (worker side) are
  structural subsets of the DOM worker types — they keep the backends testable
  in jsdom and in-process.
- The worker entry creates an `ExecutorWorkerHost` and registers the node
  providers via `addProviders`:

```ts
import { ExecutorWorkerHost } from '@0x-jerry/golden-graph-backend'
import { nodeProviders } from './nodes'

const host = new ExecutorWorkerHost()
host.addProviders(nodeProviders)
```

- The frontend attaches it with `WorkerExecutorBackend`:

```ts
import { WorkerExecutorBackend } from '@0x-jerry/golden-graph-backend'

const worker = new Worker(new URL('./executor.worker.ts', import.meta.url), {
  type: 'module',
})
const workspace = new Workspace({ executorBackend: new WorkerExecutorBackend(worker) })
await workspace.loadNodeProvidersFromBackend()
```

## 3. Message catalogue

All messages are discriminated unions keyed by a `type` string.

### Core → Backend

#### `list-node-providers`

```ts
{ type: 'list-node-providers' }
```

Ask the backend for every node provider it defines. Answered with
`node-providers`. Sent once during `workspace.loadNodeProvidersFromBackend()`.

#### `execute`

```ts
{ type: 'execute', req: ExecuteRequest }
```

Run a workflow. `ExecuteRequest`:

```ts
interface ExecuteRequest {
  /** Full workspace snapshot (`workspace.toJSON()`). */
  snapshot: IWorkspace
  /** Ids of the entry nodes the run starts from. */
  entryNodeIds: number[]
  /** Mirrors `workspace.state.debug`; backends should pace execution. */
  debug: boolean
}
```

### Backend → Core

#### `node-providers`

```ts
{
  type: 'node-providers',
  providers: INodeProvider<INodeSchema>[]
}
```

Answer to `list-node-providers`. The frontend registers every provider (see
§4). Streamed only on demand — there is no push.

#### `progress`

```ts
{ type: 'progress', currentNodeId: number }
```

A node started processing. The frontend mirrors this into
`executorState.currentNodeId` (`-1` when idle).

#### `handle-updates`

```ts
{ type: 'handle-updates', updates: HandleValueUpdate[] }
```

Handle values written by processed nodes, batched per node:

```ts
interface HandleValueUpdate {
  nodeId: number
  key: string
  value: unknown
}
```

The frontend applies each with `node.setData(key, value)` so
`handle:updated` events keep flowing exactly like a local run.

#### `finish`

```ts
{ type: 'finish', error?: string }
```

The run completed. `error` is set when it failed (message string only). The
run result/settlement is delivered through the `execute()` promise — the
frontend's `Executor._handleBackendEvent` ignores `finish` as an event.

## 4. Node discovery protocol

### `INodeProvider<INodeSchema>`

```ts
interface INodeProvider<T> {
  /** Unique provider id. An EMPTY id registers flat (non-namespaced) nodes. */
  id: string
  /** Display name — drives the "Add Node" submenu label in the renderer. */
  name: string
  /** Nodes keyed by local name; the node type is derived from id + key. */
  nodes: Record<string, T>
}
```

The backend owns node *definitions* (`INodeDefinition = { schema, execute }`)
and registers them in providers (`INodeProvider<INodeDefinition>`). When
serving the frontend, the execute functions are stripped and only the
schemas travel over the wire.

### Auto-generated node types

A node's `type` is **derived** from its provider id and record key:

```
type = id ? `${id}.${key}` : key
```

Examples:

| provider id | key | type |
| --- | --- | --- |
| `'Math'` | `'Op'` | `'Math.Op'` |
| `''` (flat) | `'Number'` | `'Number'` |
| `'subgraph'` | `'input'` | `'subgraph.input'` |

A provider whose schema already carries a `type` that differs from the derived
value is a configuration error and the registration throws. `type` is optional
on an authored schema; `Workspace.registerNodeSchema()` (direct, no provider)
still requires it.

### `INodeSchema`

```ts
interface INodeSchema {
  type?: string        // auto-filled by the provider; required for direct registration
  name: string         // node header + "Add Node" menu label
  description?: string
  internal?: boolean   // hidden from the "Add Node" menu
  nodeType?: NodeType  // NodeType.Entry = 1 marks an execution start
  handles: INodeHandleConfig[]
}
```

`INodeHandleConfig`:

```ts
interface INodeHandleConfig {
  key?: string                 // unique within node; edge loc key uses it
  accepts?: string | string[]  // data type(s) for connection matching; '*' = any
  type?: string                // render component: 'text' | 'number' | 'select' | 'image' | 'display'
  name?: string                // handle label
  description?: string         // shown in a tooltip on hover
  position?: HandlePosition    // Left = input, Right = output, None = layout-only row
  value?: unknown              // initial value
  options?: Record<string, any> // render props (select choices in options.options)
}
```

### Internal (subgraph interface) nodes

`subgraph.input` / `subgraph.output` are core-owned schemas registered through
a **core-side `subgraph` provider** (`subGraphNodeProvider` in
`SubGraphSchema.ts`); the backend registers the matching definition provider so
its executor can process them. They are `internal: true` (never shown in the
Add Node menu) and are **not served** over `node-providers` — the frontend
registers them itself in the `Workspace` constructor.

### Frontend registration flow

1. `workspace.loadNodeProvidersFromBackend()` → `backend.getNodeProviders()`.
2. Each returned provider is normalized (types stamped) and registered with
   `workspace.registerNodeProvider(provider)`.
3. `ws.providers` exposes them in registration order; the renderer's
   "Add Node" context menu groups nodes under `provider.name` submenus,
   skipping `internal` schemas and empty groups.

## 5. Execution protocol

### The snapshot (`IWorkspace`)

```ts
interface IWorkspace {
  version: string                          // for data migration
  extra: { incrementID: number }           // next free id — keeps ids stable across snapshots
  coordinate: { origin: { x, y }, scale: number }
  nodes: INode[]
  edges: IEdge[]
  groups: IGroup[]
  subGraphs: ISubGraph[]                   // recursive — each has its own IWorkspace
}
```

```ts
interface INode {
  id: number
  type: string
  data?: Record<string, unknown>   // real (non-edge-resolved) handle values
  subGraphId?: number              // set on collapsed subgraph nodes
  pos: { x: number, y: number }
  size?: { x, y }                  // 0/missing = auto
}

interface IEdge {
  id: number
  type: string
  start: INodeHandleLoc
  end: INodeHandleLoc
}

interface INodeHandleLoc {
  id: number     // node id
  key: string    // handle key
}
```

Handle locations are canonically keyed as `edgeLocKey(loc) = \`${id}:${key}\``.
The backend indexes edges by this key to resolve connections.

### Backend execution semantics

The reference engine is `WorkflowExecutor` (backend). Backends in other
languages should replicate:

- **Traversal** — stack-based, starting from the entry nodes
  (`nodeType === NodeType.Entry`). A node is re-queued until all upstream nodes
  (sources of edges into its input handles) have been processed. A loop guard
  (`MAX_ITERATIONS = 100_000`) throws on unresolvable dependency cycles.
- **Input resolution** — a left (input) handle connected by an edge reads the
  connected right (output) handle's *current* value; otherwise it reads its
  local value. `ctx.getData(key)` returns this; `ctx.setData(key, value)` writes
  the run state and accumulates a `handle-updates` batch.
- **Diff cache** — keyed by node id. A node re-executes only when its
  fully-resolved data changed since the last successful run; unchanged nodes
  are skipped and their cached outputs carry forward.
- **Subgraph nodes** (`INode.subGraphId != null`) — the collapsed node's handle
  keys are the nested workspace's interface node *ids*. Execution injects the
  node's inputs into the nested `subgraph.input` nodes, runs the nested
  workspace (lazy child executor, silent events, own diff cache), then reads
  the `subgraph.output` nodes' `Value` back onto the node's output handles.
- **Debug mode** — sleeps (100 ms per changed node) so progress stays
  observable.
- **Unknown node types** throw at runtime so misconfigured graphs fail loudly.
  Subgraph interface nodes never hit this path because the backend always
  registers the internal `subgraph` provider.

### Frontend orchestration

`Workspace.execute()` (`Executor` facade): guards re-entrancy, snapshots the
workspace, sends `execute`, and translates events:

- `progress` → `executorState.currentNodeId` + `executor:changed`.
- `handle-updates` → `node.setData(key, value)` on the live nodes.
- `finish` → settlement via the promise; errors propagate unchanged (not
  re-wrapped, so the original `name`/`stack` survive).

## 6. JSON-safety & constraints

- Every message payload is plain JSON — no class instances, no functions, no
  `undefined`-only semantics relying on transport-specific behavior.
- Enums (`HandlePosition`, `NodeType`) serialize as their numeric values.
- Execute functions never run on the frontend; they run in the worker and must
  be DOM-free.
- Handle values (initial `value`, runtime `setData` writes, `handle-updates`)
  must be structured-cloneable.
- Ids are generated starting at 1 (`createIncrementIdGenerator`) and persist via
  `extra.incrementID` — never assume sequential ids are gap-free, but do assume
  a node id always refers to the same node across snapshots.

## 7. Lifecycle

- `dispose()` terminates the worker transport and clears in-flight state.
- **Dispose ordering** — the renderer must unsubscribe from workspace events
  *before* `ws.dispose()` tears down the emitter and terminates the worker.
  `KonvaRenderer.vue` disposes the renderer in `onBeforeUnmount`, ahead of
  `useWorkspace.provide()`'s `onUnmounted(ws.dispose)`.
- `Workspace.disabled` = `state.disabled || executorState.isProcessing` — gate
  UI during runs so backend back-writes don't re-trigger runs.

## 8. Examples

### A complete JSON round trip

Request (frontend → backend):

```json
{
  "type": "list-node-providers"
}
```

Response:

```json
{
  "type": "node-providers",
  "providers": [
    {
      "id": "Math",
      "name": "Math",
      "nodes": {
        "Op": {
          "type": "Math.Op",
          "name": "Math - Op",
          "handles": [
            { "key": "a", "name": "A", "position": 1, "accepts": "number", "value": 0 },
            { "key": "out", "name": "Sum", "position": 2, "accepts": "number", "value": 0 }
          ]
        }
      }
    }
  ]
}
```

Run (frontend → backend):

```json
{
  "type": "execute",
  "req": {
    "snapshot": {
      "version": "1.0.0",
      "extra": { "incrementID": 3 },
      "coordinate": { "origin": { "x": 0, "y": 0 }, "scale": 1 },
      "nodes": [
        { "id": 1, "type": "Number", "data": { "out": 1 }, "pos": { "x": 0, "y": 0 } },
        { "id": 2, "type": "Math.Op", "data": { "a": 0, "b": 0, "out": 0 }, "pos": { "x": 200, "y": 0 } }
      ],
      "edges": [
        { "id": 1, "type": "default", "start": { "id": 1, "key": "out" }, "end": { "id": 2, "key": "a" } }
      ],
      "groups": [],
      "subGraphs": []
    },
    "entryNodeIds": [1],
    "debug": false
  }
}
```

Events (backend → frontend):

```json
{ "type": "progress", "currentNodeId": 1 }
{ "type": "handle-updates", "updates": [] }
{ "type": "progress", "currentNodeId": 2 }
{ "type": "handle-updates", "updates": [{ "nodeId": 2, "key": "out", "value": 1 }] }
{ "type": "finish" }
```

### A WebSocket backend sketch

Any process can act as the backend by speaking the same JSON:

```
frontend ──{ "type": "list-node-providers" }──────────────► ws server
frontend ◄──{ "type": "node-providers", "providers": [...] }── ws server
frontend ──{ "type": "execute", "req": { snapshot, entryNodeIds, debug } }──► ws server
frontend ◄──{ "type": "progress", "currentNodeId": ... }── ws server
frontend ◄──{ "type": "handle-updates", "updates": [...] }── ws server
frontend ◄──{ "type": "finish" }────────────── ws server
```

Implement `ExecutorBackend` on the frontend to bridge the WebSocket into the
`Executor` facade (`getNodeProviders()` answers the socket, `execute()` forwards
the request and forwards events to `onEvent`, resolving/rejecting on `finish`).
