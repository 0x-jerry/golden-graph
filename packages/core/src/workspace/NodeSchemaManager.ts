import { nodeClassFromSchema, type INodeSchema } from '../NodeSchema'
import type { Workspace } from './Workspace'

/**
 * Registers render-only node classes from JSON schemas, either registered
 * directly or fetched from an executor backend.
 */
export class NodeSchemaManager {
  constructor(readonly ws: Workspace) {}

  registerNodeSchema(schema: INodeSchema) {
    this.ws._nodeRegister.set(schema.type, nodeClassFromSchema(schema))
  }

  /**
   * Fetch all node schemas from the configured executor backend and
   * register them for rendering. Call this once after attaching a
   * backend, before adding nodes to the graph.
   */
  async loadNodeSchemasFromBackend() {
    const backend = this.ws._executor.backend

    if (!backend) {
      throw new Error(
        'Can not load node schemas: no executor backend is configured. ' +
          'Pass `executorBackend` to the Workspace options.',
      )
    }

    const schemas = await backend.getNodeSchemas()

    for (const schema of schemas) {
      this.registerNodeSchema(schema)
    }

    return schemas
  }
}
