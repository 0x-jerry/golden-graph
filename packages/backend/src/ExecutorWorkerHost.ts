import type {
  ExecuteRequest,
  ExecutorRpcMethods,
  ExecutorRpcNotifications,
  INodeProvider,
  INodeSchema,
} from '@0x-jerry/golden-graph-protocol'
import {
  ExecutorRpc,
  JsonRpcServer,
  isCancelledError,
  normalizeNodeProvider,
} from '@0x-jerry/golden-graph-protocol'
import {
  WorkflowExecutor,
  type INodeDefinition,
  nodeDefinitionTypeOf,
  nodeDefinitionWithType,
} from './WorkflowExecutor'

/**
 * Minimal structural subset of the worker global scope
 * (`DedicatedWorkerGlobalScope`) used by this host. Typing against this
 * instead of the DOM worker scope keeps the host testable in-process.
 */
export interface WorkerScopeLike {
  postMessage(message: unknown): void
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void,
  ): void
}

/**
 * The backend endpoint living inside a Web Worker — the JSON-RPC 2.0
 * server paired with `WorkerExecutorBackend` (see
 * `packages/protocol/docs/protocol.md`).
 *
 * Answers two Request methods and one Notification:
 *
 * - `goldenGraph/listNodeProviders` — replies with the providers so the
 *   frontend can render the nodes (grouped by provider name in the "Add
 *   Node" menu),
 * - `goldenGraph/execute` — runs the JSON-native `WorkflowExecutor`
 *   directly on the incoming workspace snapshot (no `Workspace` mirror is
 *   involved) and streams `goldenGraph/progress` /
 *   `goldenGraph/handleUpdates` Notifications back; the run settles with
 *   the Response (`result: null`, or `error: { code: -32000 }`, or
 *   `error: { code: -32001, message: 'cancelled' }` when stopped by a
 *   cancel),
 * - `goldenGraph/cancel` (Notification) — stops the in-flight run at its
 *   next check point; the run settles via its own `execute` Response.
 *
 * The executor's diff cache is keyed by node id, so it survives across
 * runs and unchanged nodes are skipped.
 *
 * Usage in a worker entry:
 *
 * ```ts
 * import { ExecutorWorkerHost } from '@0x-jerry/golden-graph'
 * import { nodeProviders } from './nodes'
 *
 * const host = new ExecutorWorkerHost()
 * host.addProviders(nodeProviders)
 * ```
 *
 * Execute functions run inside the worker, so they must be worker-safe
 * (no DOM access) and handle values must be structured-cloneable.
 */
export class ExecutorWorkerHost {
  readonly providers: INodeProvider<INodeDefinition>[] = []
  readonly definitions: INodeDefinition[] = []
  readonly executor: WorkflowExecutor

  _server: JsonRpcServer<ExecutorRpcMethods, ExecutorRpcNotifications>

  constructor(
    readonly _scope: WorkerScopeLike = globalThis as unknown as WorkerScopeLike,
  ) {
    this._server = new JsonRpcServer((message) => {
      this._scope.postMessage(message)
    })

    this.executor = new WorkflowExecutor({
      onProgress: (nodeId) => {
        this._server.notify(ExecutorRpc.progress, { currentNodeId: nodeId })
      },
      onHandleUpdates: (updates) => {
        this._server.notify(ExecutorRpc.handleUpdates, { updates })
      },
    })

    this._server.onRequest(ExecutorRpc.listNodeProviders, () => ({
      providers: this.schemaProviders,
    }))
    this._server.onRequest(ExecutorRpc.execute, async (req) => {
      await this._handleExecute(req)
      return null
    })
    this._server.onNotification(ExecutorRpc.cancel, () => {
      // Stop the in-flight run at its next check point; the run settles
      // through its own `execute` Response with a `-32001` Cancelled error.
      this.executor.cancel()
    })

    this._scope.addEventListener('message', (event) => {
      this._server.handleMessage(event.data)
    })
  }

  /**
   * Register node providers dynamically. Providers are normalized (derived
   * node types stamped) and grouped so the frontend can render
   * provider-named menu groups; their definitions are registered on the
   * executor for subsequent runs.
   */
  addProviders(providers: Iterable<INodeProvider<INodeDefinition>>): void {
    const normalized = [...providers].map((provider) =>
      normalizeNodeProvider(provider, nodeDefinitionTypeOf, nodeDefinitionWithType),
    )

    const definitions = normalized.flatMap((provider) =>
      Object.values(provider.nodes),
    )

    this.providers.push(...normalized)
    this.definitions.push(...definitions)
    this.executor.addDefinitions(definitions)
  }

  async _handleExecute(req: ExecuteRequest) {
    try {
      await this.executor.execute(req.snapshot, req.entryNodeIds, req.debug)
    } catch (error) {
      // Pass a cancelled run through untouched so its `-32001` code
      // survives the JSON-RPC boundary; everything else is re-wrapped so
      // only the error message travels.
      if (isCancelledError(error)) {
        throw error
      }

      throw new Error(errorMessage(error))
    }
  }

  /**
   * Providers with execute functions stripped — the wire shape sent to the
   * frontend.
   */
  get schemaProviders(): INodeProvider<INodeSchema>[] {
    return this.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      nodes: Object.fromEntries(
        Object.entries(provider.nodes).map(([key, def]) => [key, def.schema]),
      ),
    }))
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
