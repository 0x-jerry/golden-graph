import { Node, type NodeConstructor } from './Node'
import type { INodeSchema } from '@0x-jerry/golden-graph-protocol'

/**
 * Build a `Node` subclass from a JSON schema. The generated class only
 * carries render data (name, handles, node type) — execution lives on
 * the backend.
 */
export function nodeClassFromSchema(schema: INodeSchema): NodeConstructor {
  return class SchemaNode extends Node {
    static override nodeName = schema.name
    static override internal = schema.internal ?? false

    constructor() {
      super()

      this.description = schema.description

      if (schema.nodeType) {
        this.setNodeType(schema.nodeType)
      }

      for (const handle of schema.handles) {
        this.addHandle(handle)
      }
    }
  }
}
