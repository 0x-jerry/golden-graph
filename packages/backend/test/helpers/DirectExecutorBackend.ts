import type {
  ExecuteRequest,
  ExecutorBackend,
  ExecutorBackendEvent,
  INodeProvider,
  INodeSchema,
} from '@0x-jerry/golden-graph-protocol'
import {
  WorkflowExecutor,
  type INodeDefinition,
} from '../../src'

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

    this._executor = new WorkflowExecutor({
      onProgress: (nodeId) => {
        this._onEvent?.({ type: 'progress', currentNodeId: nodeId })
      },
      onHandleUpdates: (updates) => {
        this._onEvent?.({ type: 'handle-updates', updates })
      },
    })
    this._executor.addDefinitions(definitions)
  }

  async getNodeProviders(): Promise<INodeProvider<INodeSchema>[]> {
    const nodes: Record<string, INodeSchema> = {}

    for (const def of this.definitions) {
      if (def.schema.type) {
        nodes[def.schema.type] = def.schema
      }
    }

    return structuredClone([{ id: '', name: 'Direct', nodes }])
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
