import type {
  ExecuteRequest,
  ExecutorBackend,
  ExecutorBackendEvent,
  ExecutorBackendRequest,
  ExecutorBackendResponse,
  INodeProvider,
  INodeSchema,
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
 * Executor backend that fetches node providers and runs workflows inside a
 * Web Worker.
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
 */
export class WorkerExecutorBackend implements ExecutorBackend {
  _resolve?: () => void
  _reject?: (error: Error) => void
  _onEvent?: (event: ExecutorBackendEvent) => void
  _providersResolve?: (providers: INodeProvider<INodeSchema>[]) => void

  constructor(readonly worker: WorkerLike) {
    this.worker.addEventListener('message', (event) => {
      this._handleMessage(event.data as ExecutorBackendResponse)
    })
  }

  getNodeProviders(): Promise<INodeProvider<INodeSchema>[]> {
    if (this._providersResolve) {
      return Promise.reject(
        new Error('WorkerExecutorBackend.getNodeProviders is already in flight'),
      )
    }

    return new Promise<INodeProvider<INodeSchema>[]>((resolve) => {
      this._providersResolve = resolve
      this._post({ type: 'list-node-providers' })
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
    if (message.type === 'node-providers') {
      this._providersResolve?.(message.providers)
      this._providersResolve = undefined
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
