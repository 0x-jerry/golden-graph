import { describe, it, expect } from 'vitest'
import { createCanvas, DOMMatrix } from 'canvas'
import {
  Group,
  HandlePosition,
  Workspace,
  type INodeSchema,
} from '@0x-jerry/golden-graph'
import { EntityViewStore } from '../../src/renderer/EntityViewStore'
import { subscribeGraphEvents } from '../../src/renderer/GraphEventRouter'
import { KonvaGraphRenderer } from '../../src/renderer/KonvaGraphRenderer'

// jsdom lacks OffscreenCanvas/DOMMatrix/ResizeObserver; the canvas package
// provides the first two, the renderer needs a no-op observer.
globalThis.OffscreenCanvas = globalThis.OffscreenCanvas || createCanvas
globalThis.DOMMatrix = globalThis.DOMMatrix || DOMMatrix
if (!globalThis.ResizeObserver) {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = RO
}

const numberSchema: INodeSchema = {
  type: 'Number',
  name: 'Number',
  handles: [
    {
      key: 'value',
      name: 'Value',
      accepts: 'number',
      position: HandlePosition.Right,
      value: 1,
    },
  ],
}

const sumSchema: INodeSchema = {
  type: 'Sum',
  name: 'Sum',
  handles: [
    { key: 'a', name: 'A', accepts: 'number', position: HandlePosition.Left },
    { key: 'b', name: 'B', accepts: 'number', position: HandlePosition.Left },
    { key: 'out', name: 'Out', accepts: 'number', position: HandlePosition.Right },
  ],
}

function createWs() {
  const ws = new Workspace()
  ws.registerNodeSchema(numberSchema)
  ws.registerNodeSchema(sumSchema)
  return ws
}

function groupNodes(ws: Workspace, ...ids: number[]) {
  const group = new Group()
  group.id = ws.nextId()
  group.setWorkspace(ws)
  group.nodes.push(...ids)
  ws._groups.push(group)
  return group
}

/** Parent graph with an internal subgraph: 3 external edges, 3 internal. */
function createSubGraphWorkspace() {
  const ws = createWs()
  const extIn = ws.addNode('Number')
  const extOut = ws.addNode('Sum')
  const n1 = ws.addNode('Number')
  const sum = ws.addNode('Sum')

  ws.connect(extIn.getHandle('value')!, sum.getHandle('a')!)
  ws.connect(n1.getHandle('value')!, sum.getHandle('b')!)
  ws.connect(sum.getHandle('out')!, extOut.getHandle('a')!)

  const group = groupNodes(ws, n1.id, sum.id)
  ws.convertGroupToSubGraph(group.id)

  return ws
}

describe('enter/exit subgraph edge cleanup', () => {
  it('keeps the edge view store in sync with the workspace', () => {
    const ws = createSubGraphWorkspace()
    const subGraph = ws.subGraphs[0]!
    const parentEdgeCount = ws.edges.length
    const subEdgeCount = subGraph.workspace.edges.length

    const store = new EntityViewStore(ws)
    subscribeGraphEvents(
      ws,
      store,
      {
        syncCoord: () => {},
        syncState: () => {},
        syncExecutor: () => {},
        onHandleUpdated: () => {},
        onHandleConnectionChanged: () => {},
      } as never,
      { add: () => {} } as never,
    )
    store.renderAll()

    expect(store._edgeViews.size).toBe(parentEdgeCount)

    ws.enterSubGraph(subGraph.id)
    expect(store._edgeViews.size).toBe(subEdgeCount)

    ws.exitSubGraph()
    expect(store._edgeViews.size).toBe(parentEdgeCount)

    // no stale views — view ids match the live workspace edges
    const viewIds = [...store._edgeViews.keys()].sort()
    const wsEdgeIds = ws.edges.map((e) => e.id).sort()
    expect(viewIds).toEqual(wsEdgeIds)
  })

  it('does not leave orphaned edge lines on the Konva layers', () => {
    const ws = createSubGraphWorkspace()
    const subGraph = ws.subGraphs[0]!
    const parentEdgeCount = ws.edges.length
    const subEdgeCount = subGraph.workspace.edges.length

    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })

    const renderer = new KonvaGraphRenderer(container, ws)
    const store = renderer._store
    const edgeLines = () => store.edgeLayer.find('.edge-line').length

    expect(edgeLines()).toBe(parentEdgeCount)

    ws.enterSubGraph(subGraph.id)
    expect(edgeLines()).toBe(subEdgeCount)

    ws.exitSubGraph()
    expect(edgeLines()).toBe(parentEdgeCount)

    renderer.dispose()
  })
})
