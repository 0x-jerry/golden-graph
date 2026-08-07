import { describe, expect, it } from 'vitest'
import {
  collectNodeProviders,
  deriveNodeType,
  normalizeSchemaNodeProvider,
  type INodeProvider,
  type INodeSchema,
  HandlePosition,
} from '../src'

const numberSchema: INodeSchema = {
  name: 'Number',
  nodeType: 1,
  handles: [
    { key: 'out', position: HandlePosition.Right, accepts: 'number' },
  ],
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
