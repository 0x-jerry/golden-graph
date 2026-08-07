import { describe, expect, it } from 'vitest'
import { type INodeSchema, Workspace, HandlePosition } from '../src'

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
