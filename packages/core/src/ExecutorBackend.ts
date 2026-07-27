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
 * the schemas it serves via `getNodeSchemas()`, and it keeps its own diff
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
      /** Ask the backend for the JSON schemas of all nodes it defines. */
      type: 'list-node-schemas'
    }

/**
 * Wire messages sent from an executor backend transport to the frontend:
 * run events plus the node schema list response.
 */
export type ExecutorBackendResponse =
  | ExecutorBackendEvent
  | {
      /** Answer to `list-node-schemas`. */
      type: 'node-schemas'
      schemas: INodeSchema[]
    }

/**
 * Pluggable executor backend.
 *
 * Ownership model: the backend owns node *definitions* — the JSON node
 * shape (`INodeSchema`) plus the execute function — and workflow
 * execution. The frontend only renders nodes from the fetched schemas,
 * builds the graph, and sends snapshots over.
 *
 * Implementations:
 *
 * - `WorkerExecutorBackend` (in `src/backend/`) — reference backend
 *   running the JSON-native `WorkflowExecutor` inside a Web Worker.
 * - Any out-of-process backend (any language) can implement the same JSON
 *   protocol over e.g. WebSocket: answer `list-node-schemas` with the
 *   node's schemas, receive an `ExecuteRequest`, stream
 *   `ExecutorBackendEvent`s back.
 *
 * Contract: `execute()` resolves after the run completed (all events for
 * the run already delivered), and rejects when the run failed. Transports
 * may consume the `finish` event internally to settle that promise.
 */
export interface ExecutorBackend {
  /**
   * Return the JSON schemas of all nodes defined by this backend. The
   * frontend registers them via `workspace.registerNodeSchema()` so the
   * nodes can be rendered and wired into graphs.
   */
  getNodeSchemas(): Promise<INodeSchema[]>

  execute(
    req: ExecuteRequest,
    onEvent: (event: ExecutorBackendEvent) => void,
  ): Promise<void>
  dispose?(): void
}
