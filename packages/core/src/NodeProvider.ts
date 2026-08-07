import type { INodeSchema } from './NodeSchema'

/**
 * A named unit that registers a batch of nodes.
 *
 * The node `type` is auto-generated from the provider `id` and the record
 * key: `id ? \`${id}.${key}\` : key`. An empty `id` registers flat
 * (non-namespaced) node types — useful for unscoped categories.
 *
 * Generic over the payload: core registers `INodeProvider<INodeSchema>`,
 * the backend registers `INodeProvider<INodeDefinition>`.
 */
export interface INodeProvider<T> {
  /**
   * Unique provider id. When empty, node types fall back to the record key
   * (`type = key`).
   */
  id: string

  /**
   * Display name — drives the "Add Node" submenu label in the renderer.
   */
  name: string

  /**
   * Nodes keyed by local name. The node type is derived from `id` + key.
   */
  nodes: Record<string, T>
}

/**
 * Derive the node type for a provider entry: `id ? \`${id}.${key}\` : key`.
 */
export function deriveNodeType(id: string, key: string) {
  return id ? `${id}.${key}` : key
}

/**
 * Normalize a provider: return a new provider whose nodes carry the derived
 * `type` stamped on. Throws when a node already carries a `type` that
 * differs from the derived value. Never mutates the input.
 */
export function normalizeNodeProvider<T>(
  provider: INodeProvider<T>,
  resolveType: (node: T) => string | undefined,
  setType: (node: T, type: string) => T,
): INodeProvider<T> {
  const nodes: Record<string, T> = {}

  for (const [key, node] of Object.entries(provider.nodes)) {
    const type = deriveNodeType(provider.id, key)
    const existing = resolveType(node)

    if (existing != null && existing !== type) {
      throw new Error(
        `Node provider [${provider.id}] node [${key}] has type [${existing}], ` +
          `but the derived type is [${type}] (from provider id + key). ` +
          'Remove the explicit `type` or fix the provider id/key.',
      )
    }

    nodes[key] = setType(node, type)
  }

  return { ...provider, nodes }
}

/**
 * Normalize a schema provider: stamps the derived type onto each schema.
 */
export function normalizeSchemaNodeProvider(
  provider: INodeProvider<INodeSchema>,
): INodeProvider<INodeSchema> {
  return normalizeNodeProvider(
    provider,
    (schema) => schema.type,
    (schema, type) => ({ ...schema, type }),
  )
}

/**
 * Flatten a list of providers into a map keyed by node type. Nodes are
 * collected in registration order; a duplicate `type` overwrites the earlier
 * one (last registration wins — providers do not merge). Each node is
 * returned with the derived type stamped on.
 */
export function collectNodeProviders<T>(
  providers: Iterable<INodeProvider<T>>,
  resolveType: (node: T) => string | undefined,
  setType: (node: T, type: string) => T,
): Map<string, T> {
  const map = new Map<string, T>()

  for (const provider of providers) {
    for (const node of Object.values(
      normalizeNodeProvider(provider, resolveType, setType).nodes,
    )) {
      const type = resolveType(node)

      if (type != null) {
        map.set(type, node)
      }
    }
  }

  return map
}
