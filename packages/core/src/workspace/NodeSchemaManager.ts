import type { INodeSchema } from '@0x-jerry/golden-graph-protocol'
import { nodeClassFromSchema } from '../NodeSchema'
import type { Workspace } from './Workspace'

/**
 * Registers render-only node classes from JSON schemas, either registered
 * directly or fetched from an executor backend.
 */
export class NodeSchemaManager {
  constructor(readonly ws: Workspace) {}

  registerNodeSchema(schema: INodeSchema) {
    if (!schema.type) {
      throw new Error(
        'Can not register node schema: `type` is required. ' +
          'Register the schema via a provider to auto-generate it from ' +
          'the provider id + key.',
      )
    }

    this.ws._nodeRegister.set(schema.type, nodeClassFromSchema(schema))
  }

  /**
   * Fetch all node providers from the configured executor backend and
   * register them for rendering. Call this once after attaching a backend,
   * before adding nodes to the graph.
   */
  async loadNodeProvidersFromBackend() {
    const backend = this.ws._executor.backend

    if (!backend) {
      throw new Error(
        'Can not load node providers: no executor backend is configured. ' +
          'Pass `executorBackend` to the Workspace options.',
      )
    }

    const providers = await backend.getNodeProviders()

    for (const provider of providers) {
      this.ws.registerNodeProvider(provider)
    }

    return providers
  }
}
