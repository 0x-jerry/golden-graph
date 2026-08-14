import type { INodeProvider } from './NodeProvider'
import type { INodeSchema } from './NodeSchema'
import type { IWorkspace } from './types'

/**
 * A single handle value write produced while the backend was processing a
 * node. The frontend applies it with `node.setData()` so `handle:updated`
 * keeps flowing exactly like a local run.
 */
export interface HandleValueUpdate {
  nodeId: number
  key: string
  value: unknown
}

/**
 * Request sent from the frontend to an executor backend to run a workflow.
 *
 * The payload is plain JSON, so backends can live anywhere: a Web Worker,
 * a WebSocket server written in any language, etc. The backend walks the
 * `snapshot` directly (nodes, edges, subgraphs) — node shapes come from
 * the providers it serves via `getNodeProviders()`, and it keeps its own diff
 * cache keyed by node id (ids are stable across snapshots).
 */
export interface ExecuteRequest {
  /**
   * Full workspace snapshot (`workspace.toJSON()`).
   */
  snapshot: IWorkspace
  /**
   * Ids of the entry nodes the run starts from.
   */
  entryNodeIds: number[]
  /**
   * Mirrors `workspace.state.debug`; backends should pace execution (e.g.
   * sleep between nodes) so progress stays observable.
   */
  debug: boolean
}

/**
 * Events streamed from an executor backend to the frontend during a run.
 * All events are plain JSON.
 *
 * On the wire these are JSON-RPC 2.0 Notifications (see
 * {@link ExecutorRpc}): `progress` and `handleUpdates`. There is no
 * `finish` event — the run result is delivered through the `execute()`
 * promise (the `goldenGraph/execute` Response).
 */
export type ExecutorBackendEvent =
  | {
      /** A node started processing. */
      type: 'progress'
      currentNodeId: number
    }
  | {
      /** Handle values written by processed nodes. */
      type: 'handle-updates'
      updates: HandleValueUpdate[]
    }

/**
 * Pluggable executor backend.
 *
 * Ownership model: the backend owns node *definitions* — the JSON node
 * shape (`INodeSchema`) plus the execute function — organized in node
 * providers, and owns workflow execution. The frontend only renders nodes
 * from the fetched provider schemas, builds the graph, and sends snapshots
 * over.
 *
 * The backend contract is defined in JSON-RPC 2.0 terms (see
 * `packages/protocol/docs/protocol.md` and {@link ExecutorRpc}): every
 * implementation answers the `goldenGraph/listNodeProviders` request with
 * the providers' schemas, receives an `ExecuteRequest` as the params of a
 * `goldenGraph/execute` request, streams `goldenGraph/progress` /
 * `goldenGraph/handleUpdates` Notifications, and settles the run with the
 * `execute` Response (`result: null` on success, an error object with
 * `code: -32000` on failure). `cancel()` sends the
 * `goldenGraph/cancel` Notification; the cancelled run then settles with
 * error `code: -32001` (`CancelledError`).
 *
 * Implementations:
 *
 * - `WorkerExecutorBackend` (in `@0x-jerry/golden-graph-backend`) —
 *   reference backend running the JSON-native `WorkflowExecutor` inside a
 *   Web Worker; `ExecutorWorkerHost` is the JSON-RPC server endpoint it
 *   talks to.
 * - Any out-of-process backend (any language) can implement the same
 *   JSON-RPC methods over e.g. WebSocket.
 *
 * Contract: `execute()` resolves after the run completed (all events for
 * the run already delivered), and rejects when the run failed. Transports
 * settle that promise from the `goldenGraph/execute` Response.
 */
export interface ExecutorBackend {
  /**
   * Return all node providers defined by this backend. The frontend
   * registers them via `workspace.registerNodeProvider()` so the nodes can
   * be rendered and wired into graphs; provider `name` drives the "Add
   * Node" menu grouping.
   */
  getNodeProviders(): Promise<INodeProvider<INodeSchema>[]>

  execute(
    req: ExecuteRequest,
    onEvent: (event: ExecutorBackendEvent) => void,
  ): Promise<void>

  /**
   * Request the in-flight run to stop (sends the `goldenGraph/cancel`
   * Notification — fire-and-forget, nothing to await). Idempotent and a
   * no-op when no run is running or the run already settled: the
   * cancellation targets only the run in flight at call time, so a cancel
   * that races past the run's end never affects the next one.
   *
   * The run itself settles through the `execute()` promise: a cancelled
   * run rejects with a `CancelledError` (code `-32001`, message
   * `'cancelled'`).
   */
  cancel(): void
  dispose?(): void
}
