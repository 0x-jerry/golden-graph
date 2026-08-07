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
  | {
      /** The run finished; `error` is set when it failed. */
      type: 'finish'
      error?: string
    }

/**
 * Wire messages sent from the frontend to an executor backend transport.
 * Backends living behind a message channel (worker, WebSocket, ...) use
 * this union as their inbound protocol.
 */
export type ExecutorBackendRequest =
  | {
      /** Run a workflow. */
      type: 'execute'
      req: ExecuteRequest
    }
  | {
      /** Ask the backend for all node providers it defines. */
      type: 'list-node-providers'
    }

/**
 * Wire messages sent from an executor backend transport to the frontend:
 * run events plus the node provider list response.
 */
export type ExecutorBackendResponse =
  | ExecutorBackendEvent
  | {
      /** Answer to `list-node-providers`. */
      type: 'node-providers'
      providers: INodeProvider<INodeSchema>[]
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
 * Implementations:
 *
 * - `WorkerExecutorBackend` (in `@0x-jerry/golden-graph-backend`) —
 *   reference backend running the JSON-native `WorkflowExecutor` inside a
 *   Web Worker.
 * - Any out-of-process backend (any language) can implement the same JSON
 *   protocol over e.g. WebSocket: answer `list-node-providers` with the
 *   node providers' schemas, receive an `ExecuteRequest`, stream
 *   `ExecutorBackendEvent`s back.
 *
 * Contract: `execute()` resolves after the run completed (all events for
 * the run already delivered), and rejects when the run failed. Transports
 * may consume the `finish` event internally to settle that promise.
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
  dispose?(): void
}
