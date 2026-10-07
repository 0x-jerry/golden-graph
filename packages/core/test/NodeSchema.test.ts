import { describe, expect, it } from 'vitest'
import {
  HandlePosition,
  NodeType,
  Workspace,
  nodeClassFromSchema,
  type INodeSchema,
} from '../src'

const numberSchema: INodeSchema = {
  type: 'Number',
  name: 'Number Input',
  description: 'Emits a constant number',
  nodeType: NodeType.Entry,
  handles: [
    {
      key: 'output',
      name: 'Number',
      position: HandlePosition.Right,
      accepts: 'number',
      value: 10,
      type: 'number',
    },
  ],
}

describe('nodeClassFromSchema', () => {
  it('builds a node class carrying the schema shape, including after a JSON round-trip', () => {
    const Ctor = nodeClassFromSchema(numberSchema)
    const node = new Ctor()

    expect(node.name).toBe('Number Input')
    expect(node.description).toBe('Emits a constant number')
    expect(node.nodeType).toBe(NodeType.Entry)
    expect(node.handles.length).toBe(1)
    expect(node.getHandle('output')?.isRight).toBe(true)
    expect(node.getData('output')).toBe(10)

    const schema = JSON.parse(JSON.stringify(numberSchema)) as INodeSchema
    const ws = new Workspace()
    ws.registerNodeSchema(schema)

    const registered = ws.addNode('Number')
    expect(registered.name).toBe('Number Input')
    expect(registered.nodeType).toBe(NodeType.Entry)
    expect(registered.getData('output')).toBe(10)
  })

  it('exposes the internal flag as a static for menu filtering', () => {
    const internalCtor = nodeClassFromSchema({
      type: 'Internal',
      name: 'Internal',
      internal: true,
      handles: [],
    })
    const publicCtor = nodeClassFromSchema(numberSchema)

    expect(internalCtor.internal).toBe(true)
    expect(publicCtor.internal).toBe(false)
  })
})
