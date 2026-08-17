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

afterEach(() => {
  renderer?.dispose()
  renderer = null
})

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
  it('deletes the selected node with Delete', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    const b = ws.addNode('Sum')
    ws.setActiveIds(ActiveType.Node, [a.id])

    const { container } = makeRenderer(ws)
    const evt = dispatchKey(container, { key: 'Delete' })

    expect(evt.defaultPrevented).toBe(true)
    expect(ws.getNode(a.id)).toBeUndefined()
    expect(ws.getNode(b.id)).toBeDefined()
  })

  it('deletes every box-selected node', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    const b = ws.addNode('Sum')
    ws.setActiveIds(ActiveType.Node, [a.id, b.id])

    const { container } = makeRenderer(ws)
    dispatchKey(container, { key: 'Delete' })

    expect(ws.nodes).toHaveLength(0)
  })

  it('deletes a group together with its member nodes with Backspace', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    const b = ws.addNode('Sum')
    const group = groupNodes(ws, a.id, b.id)
    ws.setActiveIds(ActiveType.Group, [group.id])

    const { container } = makeRenderer(ws)
    dispatchKey(container, { key: 'Backspace' })

    expect(ws.nodes).toHaveLength(0)
    expect(ws.groups).toHaveLength(0)
  })

  it('duplicates the selected node with Ctrl+D', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    ws.setActiveIds(ActiveType.Node, [a.id])

    const { container } = makeRenderer(ws)
    const evt = dispatchKey(container, { key: 'd', ctrlKey: true })

    expect(evt.defaultPrevented).toBe(true)
    expect(ws.nodes).toHaveLength(2)
    const dup = ws.nodes.find((n) => n.id !== a.id)!
    expect(dup.pos.x).toBe(a.pos.x + 30)
    expect(dup.pos.y).toBe(a.pos.y + 30)
  })

  it('duplicates the selected node with Cmd+D (metaKey)', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    ws.setActiveIds(ActiveType.Node, [a.id])

    const { container } = makeRenderer(ws)
    dispatchKey(container, { key: 'D', metaKey: true })

    expect(ws.nodes).toHaveLength(2)
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

    const { container } = makeRenderer(ws)
    dispatchKey(container, { key: 'd', ctrlKey: true })

    const copies = ws.nodes.filter(
      (n) => isSubGraphNode(n) && n.subGraphId === subGraph.id,
    )
    expect(copies).toHaveLength(2)
  })

  it('ignores keys pressed while an input inside the canvas has focus', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    ws.setActiveIds(ActiveType.Node, [a.id])

    const { container } = makeRenderer(ws)
    const input = document.createElement('input')
    container.appendChild(input)
    input.focus()

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }),
    )

    expect(ws.getNode(a.id)).toBeDefined()
    // Drop the still-focused input so later focus assertions start clean.
    container.remove()
  })

  it('does nothing while the workspace is disabled', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    ws.setActiveIds(ActiveType.Node, [a.id])

    const { container } = makeRenderer(ws)
    ws._state.disabled = true

    dispatchKey(container, { key: 'Delete' })
    expect(ws.getNode(a.id)).toBeDefined()

    dispatchKey(container, { key: 'd', ctrlKey: true })
    expect(ws.nodes).toHaveLength(1)
  })

  it('ignores keys during IME composition', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    ws.setActiveIds(ActiveType.Node, [a.id])

    const { container } = makeRenderer(ws)
    dispatchKey(container, { key: 'Delete', isComposing: true })

    expect(ws.getNode(a.id)).toBeDefined()
  })

  it('does nothing without a selection', () => {
    const ws = createWorkspace()
    ws.addNode('Number')
    ws.addNode('Sum')

    const { container } = makeRenderer(ws)
    dispatchKey(container, { key: 'Delete' })
    dispatchKey(container, { key: 'd', ctrlKey: true })

    expect(ws.nodes).toHaveLength(2)
  })

  it('does nothing when an edge is active', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    const b = ws.addNode('Sum')
    const edge = ws.connect(a.getHandle('value')!, b.getHandle('a')!)!
    ws.setActiveIds(ActiveType.Edge, [edge.id])

    const { container } = makeRenderer(ws)
    dispatchKey(container, { key: 'Delete' })
    dispatchKey(container, { key: 'd', ctrlKey: true })

    expect(ws.edges).toHaveLength(1)
    expect(ws.nodes).toHaveLength(2)
  })

  it('ignores Delete with modifier keys and Ctrl+D with alt', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    ws.setActiveIds(ActiveType.Node, [a.id])

    const { container } = makeRenderer(ws)
    dispatchKey(container, { key: 'Delete', ctrlKey: true })
    dispatchKey(container, { key: 'Delete', altKey: true })
    dispatchKey(container, { key: 'd', ctrlKey: true, altKey: true })

    expect(ws.nodes).toHaveLength(1)
  })

  it('focuses the canvas container on pointerdown', () => {
    const ws = createWorkspace()
    const { renderer, container } = makeRenderer(ws)
    container.setAttribute('tabindex', '0')
    document.body.appendChild(container)

    container.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(document.activeElement).toBe(renderer.stage.container())
    container.remove()
  })

  it('does not steal focus from an editable target on pointerdown', () => {
    const ws = createWorkspace()
    const { container } = makeRenderer(ws)
    container.setAttribute('tabindex', '0')
    document.body.appendChild(container)

    const input = document.createElement('input')
    container.appendChild(input)
    input.focus()

    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(document.activeElement).toBe(input)
    container.remove()
  })

  it('does not steal focus from an in-progress node text edit on pointerdown', () => {
    const ws = createWorkspace()
    const { container } = makeRenderer(ws)
    container.setAttribute('tabindex', '0')
    document.body.appendChild(container)

    // Simulate an active edit: the editor's hidden <input> holds focus while
    // the click target is the canvas (not the input itself).
    const input = document.createElement('input')
    container.appendChild(input)
    input.focus()

    container.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(document.activeElement).toBe(input)
    container.remove()
  })
})
