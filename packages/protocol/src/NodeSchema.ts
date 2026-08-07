import type { NodeType } from './NodeType'
import type { INodeHandleConfig } from './NodeHandle'

/**
 * JSON-safe description of a node's shape.
 *
 * Node schemas are owned by the backend: the backend defines both the
 * shape (this schema) and the execute function, and the frontend
 * registers the schema to render generic node instances. A schema must
 * survive a `JSON.parse(JSON.stringify(schema))` round-trip — enum
 * fields (`nodeType`, handle `position`) are numbers.
 */
export interface INodeSchema {
  /**
   * Unique node type id, e.g. `'Math.Op'`.
   *
   * Optional on authored schemas: when the schema is registered via a
   * provider, the type is auto-generated as
   * `provider.id ? \`${provider.id}.${key}\` : key`. Direct
   * `registerNodeSchema()` (no provider) still requires it.
   */
  type?: string

  /**
   * Display name shown in the node header and the "Add Node" menu.
   */
  name: string

  description?: string

  /**
   * Internal nodes are hidden from the "Add Node" context menu.
   */
  internal?: boolean

  /**
   * Execution role of the node, e.g. `NodeType.Entry`.
   */
  nodeType?: NodeType

  /**
   * Handle definitions (`INodeHandleConfig` is already JSON-safe).
   */
  handles: INodeHandleConfig[]
}
