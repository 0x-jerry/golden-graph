import type {
  ExecuteRequest,
  ExecutorBackend,
  ExecutorBackendEvent,
  ExecutorRpcMethods,
  ExecutorRpcNotifications,
  INodeProvider,
  INodeSchema,
} from '@0x-jerry/golden-graph-protocol'
import { ExecutorRpc, JsonRpcClient, JsonRpcServer } from '@0x-jerry/golden-graph-protocol'
import {
  WorkflowExecutor,
  type INodeDefinition,
} from '../../src'

/**
 * In-process `ExecutorBackend` wrapping the JSON-native
 * `WorkflowExecutor` behind the same JSON-RPC 2.0 protocol the worker
 * transport uses: a `JsonRpcClient` and a `JsonRpcServer` looped back in
 * the same process, standing in for a real (worker/remote) channel.
 * Snapshots are structured-cloned to mimic transport semantics.
 *
 * One deliberate divergence from a real channel: messages are delivered
 * synchronously (the real worker defers them to later macrotasks), so a
 * cancel sent in the same tick as `execute()` can arrive before the run
 * has registered itself and be dropped. Real transports deliver the
 * cancel only after the run started, so this edge cannot occur there;
 * tests should `await` a tick (or wait a real delay) between starting a
 * run and cancelling it.
 */
export class DirectExecutorBackend implements ExecutorBackend {
  readonly definitions: INodeDefinition[]

  _server: JsonRpcServer<ExecutorRpcMethods, ExecutorRpcNotifications>
  _client: JsonRpcClient<ExecutorRpcMethods, ExecutorRpcNotifications>
  _executor: WorkflowExecutor

  constructor(definitions: INodeDefinition[]) {
    this.definitions = definitions

    this._server = new JsonRpcServer((message) => {
      this._client.handleMessage(message)
    })
    this._client = new JsonRpcClient((message) => {
      this._server.handleMessage(message)
    })

    this._server.onRequest(ExecutorRpc.listNodeProviders, () => ({
      providers: this.schemaProviders,
    }))
    this._server.onRequest(ExecutorRpc.execute, async (req) => {
      await this._execute(req)
      return null
    })
    this._server.onNotification(ExecutorRpc.cancel, () => {
      // Mirror of the worker host: stop the in-flight run; it settles
      // through its own `execute` Response with a `-32001` Cancelled error.
      this._executor.cancel()
    })

    this._executor = new WorkflowExecutor({
      onProgress: (nodeId) => {
        this._server.notify(ExecutorRpc.progress, { currentNodeId: nodeId })
      },
      onHandleUpdates: (updates) => {
        this._server.notify(ExecutorRpc.handleUpdates, { updates })
      },
    })
    this._executor.addDefinitions(definitions)
  }

  getNodeProviders(): Promise<INodeProvider<INodeSchema>[]> {
    return this._client
      .call(ExecutorRpc.listNodeProviders)
      .then((result) => result.providers)
  }

  async execute(
    req: ExecuteRequest,
    onEvent: (event: ExecutorBackendEvent) => void,
  ): Promise<void> {
    this._client.onNotification(ExecutorRpc.progress, (params) => {
      onEvent({ type: 'progress', currentNodeId: params.currentNodeId })
    })
    this._client.onNotification(ExecutorRpc.handleUpdates, (params) => {
      onEvent({ type: 'handle-updates', updates: params.updates })
    })

    try {
      await this._client.call(ExecutorRpc.execute, req)
    } finally {
      // The run settled — all its Notifications were delivered before the
      // Response (ordered channel). Drop the handlers so late/errant
      // messages can't mutate workspace state outside a run.
      this._client.offNotification(ExecutorRpc.progress)
      this._client.offNotification(ExecutorRpc.handleUpdates)
    }
  }

  async _execute(req: ExecuteRequest) {
    const snapshot = structuredClone(req.snapshot)
    await this._executor.execute(snapshot, req.entryNodeIds, req.debug)
  }

  /** Send the `goldenGraph/cancel` Notification (mirror of the worker
   * transport). Fire-and-forget; the in-flight `execute()` rejects with a
   * `-32001` Cancelled error. */
  cancel() {
    this._client.notify(ExecutorRpc.cancel)
  }

  get schemaProviders(): INodeProvider<INodeSchema>[] {
    const nodes: Record<string, INodeSchema> = {}

    for (const def of this.definitions) {
      if (def.schema.type) {
        nodes[def.schema.type] = def.schema
      }
    }

    return structuredClone([{ id: '', name: 'Direct', nodes }])
  }
}
