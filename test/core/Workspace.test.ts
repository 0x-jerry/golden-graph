import { describe, it, expect } from 'vitest'
import { HandlePosition, Node, NodeType, Workspace, Group } from '../../src/core'
import { getNodesBounding } from '../../src/core/domHelper'

class GroupTestNode extends Node {
  constructor() {
    super()
    this.addHandle({
      name: 'Input',
      key: 'input',
      type: 'string',
      position: HandlePosition.Left,
    })

    this.addHandle({
      name: 'Output',
      key: 'output',
      type: 'string',
      position: HandlePosition.Right,
    })
  }
}

class SourceNode extends Node {
  constructor() {
    super()
    this._type = 'Source'
    this.setNodeType(NodeType.Entry)
    this.addHandle({ key: 'out', position: HandlePosition.Right, type: 'number', value: 1 })
  }
  onProcess = () => {
    // no-op: emits existing value
  }
}

class ProcessNode extends Node {
  constructor() {
    super()
    this._type = 'Process'
    this.addHandle({ key: 'in', position: HandlePosition.Left, type: 'number' })
    this.addHandle({ key: 'out', position: HandlePosition.Right, type: 'number' })
  }
  onProcess = () => {
    const n = this.getData<number>('in') ?? 0
    this.setData('out', n + 1)
  }
}

class SinkNode extends Node {
  constructor() {
    super()
    this._type = 'Sink'
    this.addHandle({ key: 'in', position: HandlePosition.Left, type: 'number' })
  }
}

describe('Workspace', () => {
  it('register/add/connect/query/remove edges', () => {
    const ws = new Workspace()
    class A extends Node { constructor() { super(); this._type = 'A'; this.addHandle({ key: 'o', position: HandlePosition.Right, type: 'number' }) } }
    class B extends Node { constructor() { super(); this._type = 'B'; this.addHandle({ key: 'i', position: HandlePosition.Left, type: 'number' }) } }
    ws.registerNode('A', A)
    ws.registerNode('B', B)
    const a = ws.addNode('A')
    const b = ws.addNode('B')
    const edge = ws.connect(a.getHandle('o')!, b.getHandle('i')!)!
    expect(ws.edges.length).toBe(1)
    const edges = ws.queryEdges(a.getHandle('o')!.loc)
    expect(edges[0].id).toBe(edge.id)
    ws.removeEdgeByIds(edge.id)
    expect(ws.edges.length).toBe(0)
  })

  it('getNodesBounding throws when node DOM missing', () => {
    const ws = new Workspace()
    // register and add one node without DOM
    class A extends Node { constructor() { super(); this._type = 'A'; } }
    ws.registerNode('A', A)
    const a = ws.addNode('A', { pos: { x: 10, y: 20 } })
    expect(() => getNodesBounding([a])).toThrow()
  })

  it('execute processes graph and propagates values', async () => {
    const ws = new Workspace()
    ws.registerNode('Source', SourceNode)
    ws.registerNode('Process', ProcessNode)
    ws.registerNode('Sink', SinkNode)

    const s = ws.addNode('Source', { pos: { x: 0, y: 0 } })
    const p = ws.addNode('Process', { pos: { x: 0, y: 0 } })
    const k = ws.addNode('Sink', { pos: { x: 0, y: 0 } })

    ws.connect(s.getHandle('out')!, p.getHandle('in')!)
    ws.connect(p.getHandle('out')!, k.getHandle('in')!)

    await ws.execute()

    expect(p.getData('in')).toBe(1)
    expect(p.getData('out')).toBe(2)
    expect(k.getData('in')).toBe(2)
    expect(ws.executorState.isProcessing).toBe(false)
    expect(ws.executorState.currentNodeId).toBe(-1)
  })

  it('toJSON/fromJSON roundtrip', () => {
    const ws = new Workspace()
    ws.registerNode('Source', SourceNode)
    const s = ws.addNode('Source')
    const json = ws.toJSON()
    const ws2 = new Workspace()
    ws2.registerNode('Source', SourceNode)
    ws2.fromJSON(json)
    expect(ws2.nodes.length).toBe(1)
    expect(ws2.nodes[0].type).toBe(s.type)
  })

  it('should convert group to subgraph', () => {
    const ws = new Workspace()
    ws.registerNode('test', GroupTestNode)

    // Create nodes
    const nodeA = ws.addNode('test')
    nodeA.name = 'NodeA'
    const nodeB = ws.addNode('test')
    nodeB.name = 'NodeB'
    const nodeC = ws.addNode('test')
    nodeC.name = 'NodeC'

    // Create connections: A -> B -> C
    ws.connect(nodeA.getHandle('output')!, nodeB.getHandle('input')!)
    ws.connect(nodeB.getHandle('output')!, nodeC.getHandle('input')!)

    // Create Group manually to avoid DOM dependency
    const group = new Group()
    group.id = ws.nextId()
    group.setWorkspace(ws)
    group.nodes.push(nodeB.id)
    ws._groups.push(group)

    // Action
    ws.covertGroupToSubGraph(group.id)

    // Verification

    // 1. Group should be removed
    expect(ws.groups.length).toBe(0)

    // 2. SubGraph should be created
    expect(ws.subGraphs.length).toBe(1)
    const subGraph = ws.subGraphs[0]

    // 3. Node B should be in SubGraph
    expect(subGraph.workspace.nodes.find(n => n.id === nodeB.id)).toBeDefined()
    expect(ws.nodes.find(n => n.id === nodeB.id)).toBeUndefined()

    // 4. SubGraph should have Input and Output nodes
    const sgInput = subGraph.workspace.nodes.find(n => n.name === 'Input')
    const sgOutput = subGraph.workspace.nodes.find(n => n.name === 'Output')
    expect(sgInput).toBeDefined()
    expect(sgOutput).toBeDefined()

    // 5. Check Internal Connections
    // InputNode -> NodeB
    const bInput = nodeB.getHandle('input')!
    expect(subGraph.workspace.queryEdges(bInput.loc).length).toBe(1)

    // NodeB -> OutputNode
    const bOutput = nodeB.getHandle('output')!
    expect(subGraph.workspace.queryEdges(bOutput.loc).length).toBe(1)

    // 6. Check Main Workspace Connections
    const sgNode = ws.nodes.find(n => n instanceof Node && n !== nodeA && n !== nodeC)
    expect(sgNode).toBeDefined()

    // A -> SubGraphNode
    const aOutput = nodeA.getHandle('output')!
    const edgesFromA = ws.queryEdges(aOutput.loc)
    expect(edgesFromA.length).toBe(1)
    expect(edgesFromA[0].end.node.id).toBe(sgNode!.id)

    // SubGraphNode -> C
    const cInput = nodeC.getHandle('input')!
    const edgesToC = ws.queryEdges(cInput.loc)
    expect(edgesToC.length).toBe(1)
    expect(edgesToC[0].start.node.id).toBe(sgNode!.id)
  })

  it('should handle internal edges correctly', () => {
    const ws = new Workspace()
    ws.registerNode('test', GroupTestNode)

    const n1 = ws.addNode('test')
    const n2 = ws.addNode('test')

    ws.connect(n1.getHandle('output')!, n2.getHandle('input')!)

    const group = new Group()
    group.id = ws.nextId()
    group.setWorkspace(ws)
    group.nodes.push(n1.id, n2.id)
    ws._groups.push(group)

    ws.covertGroupToSubGraph(group.id)

    const subGraph = ws.subGraphs[0]

    // Both nodes in subgraph
    expect(subGraph.workspace.nodes.length).toBe(2)

    // Edge should be in subgraph
    expect(subGraph.workspace.edges.length).toBe(1)
    const edge = subGraph.workspace.edges[0]
    expect(edge.start.node.id).toBe(n1.id)
    expect(edge.end.node.id).toBe(n2.id)
  })

  it('should handle duplicate handle names when converting group to subgraph', () => {
    const ws = new Workspace()

    class TestNode extends Node {
      constructor() {
        super()
        this.name = 'MyNode' // Same name for all instances
        this.addHandle({
          name: 'Input',
          key: 'input',
          type: 'string',
          position: HandlePosition.Left,
        })
        this.addHandle({
          name: 'Output',
          key: 'output',
          type: 'string',
          position: HandlePosition.Right,
        })
      }
    }

    ws.registerNode('test', TestNode)

    // Create two internal nodes with same name
    const n1 = ws.addNode('test')
    n1.id = 1001
    const n2 = ws.addNode('test')
    n2.id = 1002

    // Create external nodes to connect to them
    const ext1 = ws.addNode('test')
    ext1.id = 2001
    const ext2 = ws.addNode('test')
    ext2.id = 2002

    // Connect external -> internal (Output -> Input)
    // ext1 -> n1
    ws.connect(ext1.getHandle('output')!, n1.getHandle('input')!)
    // ext2 -> n2
    ws.connect(ext2.getHandle('output')!, n2.getHandle('input')!)

    // Create group manually to avoid DOM dependency
    const group = new Group()
    group.id = 3001
    group.setWorkspace(ws)
    group.nodes.push(n1.id, n2.id)
    ws._groups.push(group)

    ws.covertGroupToSubGraph(group.id)

    const subGraphNode = ws.nodes.find((n) => n.id !== 2001 && n.id !== 2002)!
    expect(subGraphNode).toBeDefined()

    // Check handles on SubGraphNode
    // Should have two handles corresponding to the two inputs
    const handles = subGraphNode.handles

    // We expect 2 handles: MyNode_Input and MyNode_Input_1 (or similar)
    expect(handles.length).toBe(2)

    const names = handles.map((h) => h.name)
    expect(new Set(names).size).toBe(2)
    expect(names).toContain('MyNode_Input')
    // The exact second name depends on implementation, but likely MyNode_Input_1
    expect(names.some((n) => n !== 'MyNode_Input' && n.startsWith('MyNode_Input'))).toBe(true)
  })

  it('should merge inputs from same external handle', () => {
    const ws = new Workspace()
    ws.registerNode('test', GroupTestNode)

    const n1 = ws.addNode('test')
    n1.id = 1001
    const n2 = ws.addNode('test')
    n2.id = 1002

    const ext = ws.addNode('test')
    ext.id = 2001

    // ext -> n1
    ws.connect(ext.getHandle('output')!, n1.getHandle('input')!)
    // ext -> n2
    ws.connect(ext.getHandle('output')!, n2.getHandle('input')!)

    const group = new Group()
    group.id = 3001
    group.setWorkspace(ws)
    group.nodes.push(n1.id, n2.id)
    ws._groups.push(group)

    ws.covertGroupToSubGraph(group.id)

    const subGraphNode = ws.nodes.find((n) => n.id !== 2001)!

    // Should only have 1 input handle on the subgraph node
    // because both internal nodes are fed by the SAME external handle
    const handles = subGraphNode.handles
    expect(handles.length).toBe(1)

    const subGraph = ws.subGraphs[0]
    // Should have 1 Input Node inside
    const inputNodes = subGraph.workspace.nodes.filter(n => n.name === 'Input')
    expect(inputNodes.length).toBe(1)

    // That single input node should connect to BOTH n1 and n2 inside
    const outputHandle = inputNodes[0].getHandle('Output')!
    const internalEdges = subGraph.workspace.queryEdges(outputHandle.loc)
    expect(internalEdges.length).toBe(2)
  })
})

