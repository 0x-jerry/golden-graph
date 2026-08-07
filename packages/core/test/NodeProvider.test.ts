import { describe, expect, it } from 'vitest'
import {
  collectNodeProviders,
  deriveNodeType,
  normalizeSchemaNodeProvider,
  type INodeProvider,
  type INodeSchema,
  Workspace,
  HandlePosition,
} from '../src'

const numberSchema: INodeSchema = {
  name: 'Number',
  nodeType: 1,
  handles: [
    { key: 'out', position: HandlePosition.Right, accepts: 'number' },
  ],
}

function createWs() {
  return new Workspace()
}

describe('deriveNodeType', () => {
  it('namespaces with the provider id when present', () => {
    expect(deriveNodeType('Math', 'Op')).toBe('Math.Op')
  })

  it('falls back to the key for an empty provider id', () => {
    expect(deriveNodeType('', 'Number')).toBe('Number')
  })
})

describe('normalizeSchemaNodeProvider', () => {
  it('stamps the derived type and does not mutate the input', () => {
    const provider: INodeProvider<INodeSchema> = {
      id: '',
      name: 'Base',
      nodes: { Number: numberSchema },
    }

    const normalized = normalizeSchemaNodeProvider(provider)

    expect(normalized.nodes.Number!.type).toBe('Number')
    expect(provider.nodes.Number!.type).toBeUndefined()
    expect(provider.nodes.Number).toBe(numberSchema)
  })

  it('throws when an explicit type conflicts with the derived type', () => {
    const provider: INodeProvider<INodeSchema> = {
      id: 'Math',
      name: 'Math',
      nodes: { Op: { ...numberSchema, type: 'Wrong.Type' } },
    }

    expect(() => normalizeSchemaNodeProvider(provider)).toThrow(/derived type/)
  })

  it('accepts an explicit type that matches the derived type', () => {
    const provider: INodeProvider<INodeSchema> = {
      id: 'Math',
      name: 'Math',
      nodes: { Op: { ...numberSchema, type: 'Math.Op' } },
    }

    expect(normalizeSchemaNodeProvider(provider).nodes.Op!.type).toBe('Math.Op')
  })
})

describe('collectNodeProviders', () => {
  const providers: INodeProvider<INodeSchema>[] = [
    {
      id: '',
      name: 'Base',
      nodes: { Number: numberSchema, Text: { ...numberSchema, name: 'Text' } },
    },
    {
      id: 'Math',
      name: 'Math',
      nodes: { Op: { ...numberSchema, name: 'Math - Op' } },
    },
  ]

  it('flattens providers into a map keyed by derived type', () => {
    const map = collectNodeProviders(
      providers,
      (s) => s.type,
      (s, type) => ({ ...s, type }),
    )

    expect([...map.keys()]).toEqual(['Number', 'Text', 'Math.Op'])
    expect(map.get('Math.Op')!.type).toBe('Math.Op')
  })

  it('last registration wins on duplicate types (no merging)', () => {
    const dupes: INodeProvider<INodeSchema>[] = [
      { id: '', name: 'A', nodes: { X: { ...numberSchema, name: 'A.X' } } },
      { id: '', name: 'B', nodes: { X: { ...numberSchema, name: 'B.X' } } },
    ]

    const map = collectNodeProviders(
      dupes,
      (s) => s.type,
      (s, type) => ({ ...s, type }),
    )

    expect(map.size).toBe(1)
    expect(map.get('X')!.name).toBe('B.X')
  })

  it('works over arbitrary payloads via resolve/set callbacks', () => {
    type Def = { schema: INodeSchema }
    const defs: INodeProvider<Def>[] = [
      { id: 'Math', name: 'Math', nodes: { Op: { schema: { ...numberSchema } } } },
    ]

    const map = collectNodeProviders(
      defs,
      (def) => def.schema.type,
      (def, type) => ({ ...def, schema: { ...def.schema, type } }),
    )

    expect([...map.keys()]).toEqual(['Math.Op'])
    expect(map.get('Math.Op')!.schema.type).toBe('Math.Op')
  })
})

describe('Workspace.registerNodeProvider', () => {
  it('registers providers and exposes them in order', () => {
    const ws: Workspace = createWs()

    ws.registerNodeProvider({
      id: 'Math',
      name: 'Math',
      nodes: { Op: { ...numberSchema, name: 'Math - Op' } },
    })

    expect(ws.providers.map((p) => p.id)).toEqual(['subgraph', 'Math'])
    expect(ws.providers.map((p) => p.name)).toEqual(['SubGraph', 'Math'])
    expect(ws.nodeRegister.has('Math.Op')).toBe(true)
  })

  it('merges re-registrations of the same provider id', () => {
    const ws: Workspace = createWs()

    ws.registerNodeProvider({
      id: 'Math',
      name: 'Math',
      nodes: { Op: { ...numberSchema, name: 'Math - Op' } },
    })
    ws.registerNodeProvider({
      id: 'Math',
      name: 'Math',
      nodes: { Add: { ...numberSchema, name: 'Math - Add' } },
    })

    expect(ws.nodeRegister.has('Math.Op')).toBe(true)
    expect(ws.nodeRegister.has('Math.Add')).toBe(true)
    expect(ws.providers.filter((p) => p.id === 'Math').length).toBe(1)
  })

  it('registers the subgraph interface nodes by default', () => {
    const ws: Workspace = createWs()

    expect(ws.nodeRegister.has('subgraph.input')).toBe(true)
    expect(ws.nodeRegister.has('subgraph.output')).toBe(true)
    expect(ws.nodeRegister.get('subgraph.input')!.internal).toBe(true)
  })

  it('direct registerNodeSchema still requires a type', () => {
    const ws: Workspace = createWs()

    expect(() => ws.registerNodeSchema(numberSchema)).toThrow(/`type` is required/)
  })
})
