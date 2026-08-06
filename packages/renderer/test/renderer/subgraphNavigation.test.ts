import { describe, it, expect } from 'vitest'
import { EntityViewStore } from '../../src/renderer/EntityViewStore'
import { subscribeGraphEvents } from '../../src/renderer/GraphEventRouter'
import { KonvaGraphRenderer } from '../../src/renderer/KonvaGraphRenderer'
import { createSubGraphWorkspace } from '../helpers/workspace'

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
