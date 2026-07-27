import type {
  ExecuteRequest,
  ExecutorBackendRequest,
  ExecutorBackendResponse,
} from '../core/ExecutorBackend'
import { WorkflowExecutor, type INodeDefinition } from './WorkflowExecutor'

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
 * Owns the node definitions (JSON schema + execute function) and answers
 * two request types:
 *
 * - `list-node-schemas` — replies with the schemas so the frontend can
 *   render the nodes,
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
 * import { nodeDefinitions } from './nodes'
 *
 * new ExecutorWorkerHost(nodeDefinitions)
 * ```
 *
 * Execute functions run inside the worker, so they must be worker-safe
 * (no DOM access) and handle values must be structured-cloneable.
 */
export class ExecutorWorkerHost {
  readonly definitions: INodeDefinition[]
  readonly executor: WorkflowExecutor

  constructor(
    definitions: INodeDefinition[],
    readonly _scope: WorkerScopeLike = globalThis as unknown as WorkerScopeLike,
  ) {
    this.definitions = definitions

    this.executor = new WorkflowExecutor(definitions, {
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

  async _handleMessage(message: ExecutorBackendRequest) {
    if (message.type === 'list-node-schemas') {
      this._post({
        type: 'node-schemas',
        schemas: this.definitions.map((def) => def.schema),
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
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
