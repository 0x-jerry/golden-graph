import type {
  ExecuteRequest,
  ExecutorBackend,
  ExecutorBackendEvent,
  ExecutorRpcMethods,
  ExecutorRpcNotifications,
  INodeProvider,
  INodeSchema,
} from '@0x-jerry/golden-graph-protocol'
import { ExecutorRpc, JsonRpcClient } from '@0x-jerry/golden-graph-protocol'

/**
 * Minimal structural subset of the DOM `Worker` used by this backend.
 * Typing against this instead of `Worker` keeps the backend usable in
 * environments without a real worker (e.g. tests under jsdom).
 */
export interface WorkerLike {
  postMessage(message: unknown): void
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void,
  ): void
  removeEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void,
  ): void
  terminate(): void
}

/**
 * Executor backend that fetches node providers and runs workflows inside a
 * Web Worker over JSON-RPC 2.0 (see `packages/protocol/docs/protocol.md`).
 *
 * The worker entry must create an `ExecutorWorkerHost` holding the node
 * providers:
 *
 * ```ts
 * // executor.worker.ts
 * import { ExecutorWorkerHost } from '@0x-jerry/golden-graph'
 * import { nodeProviders } from './nodes'
 *
 * const host = new ExecutorWorkerHost()
 * host.addProviders(nodeProviders)
 * ```
 *
 * ```ts
 * const backend = new WorkerExecutorBackend(
 *   new Worker(new URL('./executor.worker.ts', import.meta.url), {
 *     type: 'module',
 *   }),
 * )
 * const workspace = new Workspace({ executorBackend: backend })
 * await workspace.loadNodeProvidersFromBackend()
 * ```
 *
 * Wire shape: this client sends `goldenGraph/listNodeProviders`,
 * `goldenGraph/execute` Requests (correlated by id) and the
 * `goldenGraph/cancel` Notification, receives the
 * `goldenGraph/progress` / `goldenGraph/handleUpdates` Notifications, and
 * settles each run from the `execute` Response (`result: null` on
 * success, an error object with `code: -32000` on failure, `code: -32001`
 * when the run was cancelled via `cancel()`).
 */
export class WorkerExecutorBackend implements ExecutorBackend {
  _client: JsonRpcClient<ExecutorRpcMethods, ExecutorRpcNotifications>
  _providersInFlight = false
  _executing = false

  constructor(readonly worker: WorkerLike) {
    this._client = new JsonRpcClient((message) => {
      this.worker.postMessage(message)
    })
    this.worker.addEventListener('message', (event) => {
      this._client.handleMessage(event.data)
    })
  }

  async getNodeProviders(): Promise<INodeProvider<INodeSchema>[]> {
    if (this._providersInFlight) {
      return Promise.reject(
        new Error(
          'WorkerExecutorBackend.getNodeProviders is already in flight',
        ),
      )
    }

    this._providersInFlight = true

    try {
      const result = await this._client.call(ExecutorRpc.listNodeProviders)
      return result.providers
    } finally {
      this._providersInFlight = false
    }
  }

  async execute(
    req: ExecuteRequest,
    onEvent: (event: ExecutorBackendEvent) => void,
  ): Promise<void> {
    if (this._executing) {
      return Promise.reject(
        new Error('WorkerExecutorBackend is already executing'),
      )
    }

    this._executing = true

    this._client.onNotification(ExecutorRpc.progress, (params) => {
      onEvent({ type: 'progress', currentNodeId: params.currentNodeId })
    })
    this._client.onNotification(ExecutorRpc.handleUpdates, (params) => {
      onEvent({ type: 'handle-updates', updates: params.updates })
    })

    try {
      await this._client.call(ExecutorRpc.execute, req)
      return undefined
    } finally {
      this._executing = false
      // The run settled — all its Notifications were delivered before the
      // Response (ordered channel). Drop the handlers so late/errant
      // messages can't mutate workspace state outside a run.
      this._client.offNotification(ExecutorRpc.progress)
      this._client.offNotification(ExecutorRpc.handleUpdates)
    }
  }

  /**
   * Send the `goldenGraph/cancel` Notification to the worker. Fire-and-
   * forget: the in-flight `execute()` settles on its own (a cancelled run
   * rejects with a `-32001` Cancelled error). No-op when idle.
   */
  cancel() {
    this._client.notify(ExecutorRpc.cancel)
  }

  dispose() {
    this._client.dispose()
    this.worker.terminate()
  }
}
