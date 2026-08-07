import type {
  ExecuteRequest,
  ExecutorBackendRequest,
  ExecutorBackendResponse,
  INodeProvider,
  INodeSchema,
} from '@0x-jerry/golden-graph-protocol'
import { normalizeNodeProvider } from '@0x-jerry/golden-graph-protocol'
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
 * The backend endpoint living inside a Web Worker.
 *
 * Owns the node definitions (JSON schema + execute function), grouped in
 * node providers, and answers two request types:
 *
 * - `list-node-providers` — replies with the providers so the frontend can
 *   render the nodes (grouped by provider name in the "Add Node" menu),
 * - `execute` — runs the JSON-native `WorkflowExecutor` directly on the
 *   incoming workspace snapshot (no `Workspace` mirror is involved) and
 *   streams progress + handle value writes back.
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

  constructor(
    readonly _scope: WorkerScopeLike = globalThis as unknown as WorkerScopeLike,
  ) {
    this.executor = new WorkflowExecutor([], {
      onProgress: (nodeId) => {
        this._post({ type: 'progress', currentNodeId: nodeId })
      },
      onHandleUpdates: (updates) => {
        this._post({ type: 'handle-updates', updates })
      },
    })

    this._scope.addEventListener('message', (event) => {
      void this._handleMessage(event.data as ExecutorBackendRequest)
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

  async _handleMessage(message: ExecutorBackendRequest) {
    if (message.type === 'list-node-providers') {
      this._post({
        type: 'node-providers',
        providers: this.schemaProviders,
      })
      return
    }

    await this._handleExecute(message.req)
  }

  async _handleExecute(req: ExecuteRequest) {
    try {
      await this.executor.execute(req.snapshot, req.entryNodeIds, req.debug)
      this._post({ type: 'finish' })
    } catch (error) {
      this._post({ type: 'finish', error: errorMessage(error) })
    }
  }

  _post(event: ExecutorBackendResponse) {
    this._scope.postMessage(event)
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
