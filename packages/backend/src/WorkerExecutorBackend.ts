import type {
  ExecuteRequest,
  ExecutorBackend,
  ExecutorBackendEvent,
  ExecutorBackendRequest,
  ExecutorBackendResponse,
  INodeSchema
} from '@0x-jerry/golden-graph'

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
 * Executor backend that fetches node schemas and runs workflows inside a
 * Web Worker.
 *
 * The worker entry must create an `ExecutorWorkerHost` holding the node
 * definitions:
 *
 * ```ts
 * // executor.worker.ts
 * import { ExecutorWorkerHost } from '@0x-jerry/golden-graph'
 * import { nodeDefinitions } from './nodes'
 *
 * new ExecutorWorkerHost(nodeDefinitions)
 * ```
 *
 * ```ts
 * const backend = new WorkerExecutorBackend(
 *   new Worker(new URL('./executor.worker.ts', import.meta.url), {
 *     type: 'module',
 *   }),
 * )
 * const workspace = new Workspace({ executorBackend: backend })
 * await workspace.loadNodeSchemasFromBackend()
 * ```
 */
export class WorkerExecutorBackend implements ExecutorBackend {
  _resolve?: () => void
  _reject?: (error: Error) => void
  _onEvent?: (event: ExecutorBackendEvent) => void
  _schemasResolve?: (schemas: INodeSchema[]) => void

  constructor(readonly worker: WorkerLike) {
    this.worker.addEventListener('message', (event) => {
      this._handleMessage(event.data as ExecutorBackendResponse)
    })
  }

  getNodeSchemas(): Promise<INodeSchema[]> {
    if (this._schemasResolve) {
      return Promise.reject(
        new Error('WorkerExecutorBackend.getNodeSchemas is already in flight'),
      )
    }

    return new Promise<INodeSchema[]>((resolve) => {
      this._schemasResolve = resolve
      this._post({ type: 'list-node-schemas' })
    })
  }

  execute(
    req: ExecuteRequest,
    onEvent: (event: ExecutorBackendEvent) => void,
  ): Promise<void> {
    if (this._resolve) {
      return Promise.reject(
        new Error('WorkerExecutorBackend is already executing'),
      )
    }

    return new Promise<void>((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject
      this._onEvent = onEvent

      this._post({ type: 'execute', req })
    })
  }

  dispose() {
    this._reset()
    this.worker.terminate()
  }

  _post(message: ExecutorBackendRequest) {
    this.worker.postMessage(message)
  }

  _handleMessage(message: ExecutorBackendResponse) {
    if (message.type === 'node-schemas') {
      this._schemasResolve?.(message.schemas)
      this._schemasResolve = undefined
      return
    }

    if (message.type !== 'finish') {
      this._onEvent?.(message)
      return
    }

    if (message.error) {
      this._reject?.(new Error(message.error))
    } else {
      this._resolve?.()
    }

    this._reset()
  }

  _reset() {
    this._resolve = undefined
    this._reject = undefined
    this._onEvent = undefined
  }
}
