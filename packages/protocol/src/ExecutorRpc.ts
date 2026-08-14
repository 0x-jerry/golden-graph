import type { ExecuteRequest, HandleValueUpdate } from './ExecutorBackend'
import type { JsonRpcMethodContract } from './jsonrpc'
import type { INodeProvider } from './NodeProvider'
import type { INodeSchema } from './NodeSchema'

/**
 * The golden-graph JSON-RPC method names (namespace `goldenGraph`).
 *
 * The spec (§4) only reserves the `rpc.` prefix, so these names are
 * free to use and avoid collisions on shared channels.
 *
 * Wire contract:
 *
 * - `goldenGraph/listNodeProviders` — Request, no `params`. Responds with
 *   `result: { providers }`. Asked once during
 *   `workspace.loadNodeProvidersFromBackend()`.
 * - `goldenGraph/execute` — Request, `params` is the `ExecuteRequest`
 *   (snapshot + entry node ids + debug flag). Responds with
 *   `result: null` once the run completed; a run failure responds with an
 *   error object `{ code: -32000, message }`.
 * - `goldenGraph/progress` — Notification, `params: { currentNodeId }`
 *   (the node that started processing; `-1` when idle).
 * - `goldenGraph/handleUpdates` — Notification,
 *   `params: { updates: HandleValueUpdate[] }` (handle values written by
 *   processed nodes, batched per node).
 * - `goldenGraph/cancel` — Notification, no `params`. Requests the
 *   in-flight run to stop. Idempotent; a no-op when no run is running or
 *   when the run already settled. The run settles via its own `execute`
 *   Response with error `{ code: -32001, message: 'cancelled' }`
 *   (see `CancelledError` in `jsonrpc.ts`).
 */
export const ExecutorRpc = {
  listNodeProviders: 'goldenGraph/listNodeProviders',
  execute: 'goldenGraph/execute',
  progress: 'goldenGraph/progress',
  handleUpdates: 'goldenGraph/handleUpdates',
  cancel: 'goldenGraph/cancel',
} as const

/** `result` of `goldenGraph/listNodeProviders`. */
export interface ListNodeProvidersResult {
  providers: INodeProvider<INodeSchema>[]
}

/** `params` of the `goldenGraph/progress` Notification. */
export interface ProgressParams {
  currentNodeId: number
}

/** `params` of the `goldenGraph/handleUpdates` Notification. */
export interface HandleUpdatesParams {
  updates: HandleValueUpdate[]
}

/**
 * Method contracts, consumed by `JsonRpcClient`/`JsonRpcServer` so
 * `call()`/`onRequest()` infer `params` and `result` types.
 */
export type ExecutorRpcMethods = {
  [ExecutorRpc.listNodeProviders]: JsonRpcMethodContract<
    undefined,
    ListNodeProvidersResult
  >
  [ExecutorRpc.execute]: JsonRpcMethodContract<ExecuteRequest, null>
}

/** Notification contracts, consumed by `JsonRpcClient`/`JsonRpcServer`.
 * A plain object type (no index signature) so `onNotification`/`notify`
 * type-check the method names. */
export type ExecutorRpcNotifications = {
  [ExecutorRpc.progress]: ProgressParams
  [ExecutorRpc.handleUpdates]: HandleUpdatesParams
  /** Fire-and-forget: stop the in-flight run (no params on the wire). */
  [ExecutorRpc.cancel]: undefined
}
