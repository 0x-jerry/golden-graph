import type {
  ExecuteRequest,
  ExecutorBackend,
  ExecutorBackendEvent,
  INodeSchema,
} from '../../src/core'
import {
  WorkflowExecutor,
  type INodeDefinition,
} from '../../src/backend'

/**
 * In-process `ExecutorBackend` wrapping the JSON-native
 * `WorkflowExecutor`. Test helper standing in for a real (worker/remote)
 * backend — messages are structured-cloned to mimic transport semantics.
 */
export class DirectExecutorBackend implements ExecutorBackend {
  readonly definitions: INodeDefinition[]

  _executor: WorkflowExecutor
  _onEvent?: (event: ExecutorBackendEvent) => void

  constructor(definitions: INodeDefinition[]) {
    this.definitions = definitions

    this._executor = new WorkflowExecutor(definitions, {
      onProgress: (nodeId) => {
        this._onEvent?.({ type: 'progress', currentNodeId: nodeId })
      },
      onHandleUpdates: (updates) => {
        this._onEvent?.({ type: 'handle-updates', updates })
      },
    })
  }

  async getNodeSchemas(): Promise<INodeSchema[]> {
    return structuredClone(this.definitions.map((def) => def.schema))
  }

  async execute(
    req: ExecuteRequest,
    onEvent: (event: ExecutorBackendEvent) => void,
  ): Promise<void> {
    this._onEvent = onEvent

    try {
      const snapshot = structuredClone(req.snapshot)
      await this._executor.execute(snapshot, req.entryNodeIds, req.debug)
    } finally {
      this._onEvent = undefined
    }
  }
}
