import { afterEach, describe, expect, it } from 'vitest'
import { ActiveType, Workspace, isSubGraphNode } from '@0x-jerry/golden-graph'
import { KonvaGraphRenderer } from '../../src/renderer/KonvaGraphRenderer'
import { createWorkspace, groupNodes } from '../helpers/workspace'

let renderer: KonvaGraphRenderer | null = null

function makeRenderer(ws: Workspace) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800 })
  Object.defineProperty(container, 'clientHeight', { value: 600 })
  renderer = new KonvaGraphRenderer(container, ws)
  return { renderer, container }
}

function resetRenderer() {
  renderer?.dispose()
  renderer = null
}

afterEach(resetRenderer)

function dispatchKey(
  container: HTMLElement,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const evt = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  container.dispatchEvent(evt)
  return evt
}

describe('KeyboardShortcutController', () => {
  it('deletes the selected nodes or group with Delete/Backspace', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    const b = ws.addNode('Sum')
    ws.setActiveIds(ActiveType.Node, [a.id])
    const { container } = makeRenderer(ws)
    const evt = dispatchKey(container, { key: 'Delete' })
    expect(evt.defaultPrevented).toBe(true)
    expect(ws.getNode(a.id)).toBeUndefined()
    expect(ws.getNode(b.id)).toBeDefined()
    resetRenderer()

    // box-selected nodes all go
    const ws2 = createWorkspace()
    const c = ws2.addNode('Number')
    const d = ws2.addNode('Sum')
    ws2.setActiveIds(ActiveType.Node, [c.id, d.id])
    dispatchKey(makeRenderer(ws2).container, { key: 'Delete' })
    expect(ws2.nodes).toHaveLength(0)
    resetRenderer()

    // a group takes its members with it
    const ws3 = createWorkspace()
    const e = ws3.addNode('Number')
    const f = ws3.addNode('Sum')
    const group = groupNodes(ws3, e.id, f.id)
    ws3.setActiveIds(ActiveType.Group, [group.id])
    dispatchKey(makeRenderer(ws3).container, { key: 'Backspace' })
    expect(ws3.nodes).toHaveLength(0)
    expect(ws3.groups).toHaveLength(0)
  })

  it('duplicates the selected node with Ctrl+D or Cmd+D', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    ws.setActiveIds(ActiveType.Node, [a.id])
    const evt = dispatchKey(makeRenderer(ws).container, {
      key: 'd',
      ctrlKey: true,
    })
    expect(evt.defaultPrevented).toBe(true)
    expect(ws.nodes).toHaveLength(2)
    const dup = ws.nodes.find((n) => n.id !== a.id)!
    expect(dup.pos.x).toBe(a.pos.x + 30)
    expect(dup.pos.y).toBe(a.pos.y + 30)
    resetRenderer()

    const ws2 = createWorkspace()
    const b = ws2.addNode('Number')
    ws2.setActiveIds(ActiveType.Node, [b.id])
    dispatchKey(makeRenderer(ws2).container, { key: 'D', metaKey: true })
    expect(ws2.nodes).toHaveLength(2)
  })

  it('duplicates a subgraph node by reusing the same sub-graph', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    const b = ws.addNode('Sum')
    ws.connect(a.getHandle('value')!, b.getHandle('a')!)

    const group = groupNodes(ws, a.id, b.id)
    ws.convertGroupToSubGraph(group.id)

    const subGraph = ws.subGraphs[0]!
    const original = ws.nodes.find((n) => isSubGraphNode(n))!
    ws.setActiveIds(ActiveType.Node, [original.id])

    dispatchKey(makeRenderer(ws).container, { key: 'd', ctrlKey: true })

    const copies = ws.nodes.filter(
      (n) => isSubGraphNode(n) && n.subGraphId === subGraph.id,
    )
    expect(copies).toHaveLength(2)
  })

  it('ignores shortcuts when focused, disabled, composing, unselected or modal', () => {
    // an input inside the canvas has focus
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    ws.setActiveIds(ActiveType.Node, [a.id])
    const r = makeRenderer(ws)
    const input = document.createElement('input')
    r.container.appendChild(input)
    input.focus()
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }),
    )
    expect(ws.getNode(a.id)).toBeDefined()
    r.container.remove()
    resetRenderer()

    // disabled workspace ignores both delete and duplicate
    const ws2 = createWorkspace()
    const b = ws2.addNode('Number')
    ws2.setActiveIds(ActiveType.Node, [b.id])
    const r2 = makeRenderer(ws2)
    ws2._state.disabled = true
    dispatchKey(r2.container, { key: 'Delete' })
    expect(ws2.getNode(b.id)).toBeDefined()
    dispatchKey(r2.container, { key: 'd', ctrlKey: true })
    expect(ws2.nodes).toHaveLength(1)
    resetRenderer()

    // IME composition
    const ws3 = createWorkspace()
    const c = ws3.addNode('Number')
    ws3.setActiveIds(ActiveType.Node, [c.id])
    dispatchKey(makeRenderer(ws3).container, {
      key: 'Delete',
      isComposing: true,
    })
    expect(ws3.getNode(c.id)).toBeDefined()
    resetRenderer()

    // no selection
    const ws4 = createWorkspace()
    ws4.addNode('Number')
    ws4.addNode('Sum')
    const r4 = makeRenderer(ws4)
    dispatchKey(r4.container, { key: 'Delete' })
    dispatchKey(r4.container, { key: 'd', ctrlKey: true })
    expect(ws4.nodes).toHaveLength(2)
    resetRenderer()

    // an edge is active
    const ws5 = createWorkspace()
    const e = ws5.addNode('Number')
    const f = ws5.addNode('Sum')
    const edge = ws5.connect(e.getHandle('value')!, f.getHandle('a')!)!
    ws5.setActiveIds(ActiveType.Edge, [edge.id])
    const r5 = makeRenderer(ws5)
    dispatchKey(r5.container, { key: 'Delete' })
    dispatchKey(r5.container, { key: 'd', ctrlKey: true })
    expect(ws5.edges).toHaveLength(1)
    expect(ws5.nodes).toHaveLength(2)
    resetRenderer()

    // modifier / alt variants are not shortcuts
    const ws6 = createWorkspace()
    const g = ws6.addNode('Number')
    ws6.setActiveIds(ActiveType.Node, [g.id])
    const r6 = makeRenderer(ws6)
    dispatchKey(r6.container, { key: 'Delete', ctrlKey: true })
    dispatchKey(r6.container, { key: 'Delete', altKey: true })
    dispatchKey(r6.container, { key: 'd', ctrlKey: true, altKey: true })
    expect(ws6.nodes).toHaveLength(1)
  })

  it('focuses the canvas on pointerdown but never steals focus from an editable target', () => {
    const ws = createWorkspace()
    const r = makeRenderer(ws)
    r.container.setAttribute('tabindex', '0')
    document.body.appendChild(r.container)
    r.container.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true }),
    )
    expect(document.activeElement).toBe(r.renderer.stage.container())
    r.container.remove()
    resetRenderer()

    // an editable child keeps focus
    const ws2 = createWorkspace()
    const r2 = makeRenderer(ws2)
    r2.container.setAttribute('tabindex', '0')
    document.body.appendChild(r2.container)
    const editable = document.createElement('input')
    r2.container.appendChild(editable)
    editable.focus()
    editable.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(document.activeElement).toBe(editable)
    r2.container.remove()
    resetRenderer()

    // an in-progress edit keeps focus even when the canvas is the click target
    const ws3 = createWorkspace()
    const r3 = makeRenderer(ws3)
    r3.container.setAttribute('tabindex', '0')
    document.body.appendChild(r3.container)
    const editing = document.createElement('input')
    r3.container.appendChild(editing)
    editing.focus()
    r3.container.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true }),
    )
    expect(document.activeElement).toBe(editing)
    r3.container.remove()
  })
})
