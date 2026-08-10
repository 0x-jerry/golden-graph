import { describe, it, expect, vi } from 'vitest'
import { HandlePosition, Workspace } from '@0x-jerry/golden-graph'
import type { INodeSchema } from '@0x-jerry/golden-graph'
import { KonvaGraphRenderer } from '../../src/renderer/KonvaGraphRenderer'
import { getHandleView } from '../../src/renderer/HandleView'
import { TOOLTIP_DELAY, disposeTooltip } from '../../src/renderer/tooltip'

const describedSchema: INodeSchema = {
  type: 'Described',
  name: 'Described',
  handles: [
    {
      key: 'in',
      name: 'Input',
      accepts: 'number',
      position: HandlePosition.Left,
      value: 1,
      description: 'The numeric input value',
    },
    {
      key: 'out',
      name: 'Output',
      accepts: 'number',
      position: HandlePosition.Right,
      value: 1,
      description: 'The numeric output value',
    },
  ],
}

function tooltipEl(): HTMLDivElement | null {
  return document.querySelector<HTMLDivElement>('.r-graph-tooltip')
}

/** jsdom reports 0 for offset sizes; force fixed values on the tooltip. */
function mockTooltipSize(width: number, height: number) {
  const el = tooltipEl()!
  Object.defineProperty(el, 'offsetWidth', { value: width })
  Object.defineProperty(el, 'offsetHeight', { value: height })
}

function assertHidden() {
  const el = tooltipEl()
  if (el) {
    expect(el.style.display).toBe('none')
  }
}

function assertVisible(text: string) {
  const el = tooltipEl()
  expect(el).not.toBeNull()
  expect(el!.style.display).toBe('block')
  expect(el!.textContent).toBe(text)
}

function makeRenderer(ws: Workspace) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800 })
  Object.defineProperty(container, 'clientHeight', { value: 600 })
  const renderer = new KonvaGraphRenderer(container, ws)
  // jsdom returns zeros for getBoundingClientRect; give it a fixed box so
  // viewport-relative positioning is deterministic.
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({ left: 10, top: 20, right: 810, bottom: 620 }),
  })
  return renderer
}

describe('handle tooltip', () => {
  it('positions the tooltip at the handle row, not the node origin', () => {
    vi.useFakeTimers()
    try {
      const ws = new Workspace()
      ws.registerNodeSchema(describedSchema)
      const node = ws.addNode('Described')
      node.moveTo(100, 100)
      const renderer = makeRenderer(ws)
      try {
        const out = getHandleView(node.getHandle('out')!)!
        const joint = out._joint!.getAbsolutePosition()

        // First show creates the element while jsdom reports size 0; hide it,
        // mock real dimensions, then re-show to exercise the alignment math.
        out.group.fire('mouseenter')
        vi.advanceTimersByTime(TOOLTIP_DELAY)
        mockTooltipSize(150, 30)
        out.group.fire('mouseleave')

        out.group.fire('mouseenter')
        vi.advanceTimersByTime(TOOLTIP_DELAY)
        const el = tooltipEl()!
        // Right handle: tooltip grows leftward from the joint (right edge at
        // the joint), sitting over the handle instead of off the node's side.
        expect(parseFloat(el.style.left)).toBeCloseTo(10 + joint.x - 150, 0)
        expect(parseFloat(el.style.top)).toBeLessThan(20 + joint.y)
      } finally {
        renderer.dispose()
      }
    } finally {
      disposeTooltip()
      vi.useRealTimers()
    }
  })

  it('grows a left handle tooltip rightward from the joint', () => {
    vi.useFakeTimers()
    try {
      const ws = new Workspace()
      ws.registerNodeSchema(describedSchema)
      const node = ws.addNode('Described')
      node.moveTo(100, 100)
      const renderer = makeRenderer(ws)
      try {
        const view = getHandleView(node.getHandle('in')!)!
        const abs = view._joint!.getAbsolutePosition()

        view.group.fire('mouseenter')
        vi.advanceTimersByTime(TOOLTIP_DELAY)
        mockTooltipSize(150, 30)
        view.group.fire('mouseleave')

        view.group.fire('mouseenter')
        vi.advanceTimersByTime(TOOLTIP_DELAY)
        const el = tooltipEl()!
        // Left handle: left edge at the joint, extending right over the handle.
        expect(parseFloat(el.style.left)).toBeCloseTo(10 + abs.x, 0)
        expect(parseFloat(el.style.top)).toBeLessThan(20 + abs.y)
      } finally {
        renderer.dispose()
      }
    } finally {
      disposeTooltip()
      vi.useRealTimers()
    }
  })

  it('shows the description after the hover delay and hides on leave', () => {
    vi.useFakeTimers()
    try {
      const ws = new Workspace()
      ws.registerNodeSchema(describedSchema)
      ws.addNode('Described')
      const renderer = makeRenderer(ws)
      try {
        const handle = ws.nodes[0]!.getHandle('out')!
        const view = getHandleView(handle)!

        assertHidden()

        view.group.fire('mouseenter')
        assertHidden()

        vi.advanceTimersByTime(TOOLTIP_DELAY)
        assertVisible('The numeric output value')

        view.group.fire('mouseleave')
        assertHidden()
      } finally {
        renderer.dispose()
      }
    } finally {
      disposeTooltip()
      vi.useRealTimers()
    }
  })

  it('resets the delay when the pointer leaves before it fires', () => {
    vi.useFakeTimers()
    try {
      const ws = new Workspace()
      ws.registerNodeSchema(describedSchema)
      ws.addNode('Described')
      const renderer = makeRenderer(ws)
      try {
        const view = getHandleView(ws.nodes[0]!.getHandle('out')!)!

        view.group.fire('mouseenter')
        view.group.fire('mouseleave')
        vi.advanceTimersByTime(TOOLTIP_DELAY)
        assertHidden()
      } finally {
        renderer.dispose()
      }
    } finally {
      disposeTooltip()
      vi.useRealTimers()
    }
  })

  it('hides the tooltip when the coordinate system changes', () => {
    vi.useFakeTimers()
    try {
      const ws = new Workspace()
      ws.registerNodeSchema(describedSchema)
      ws.addNode('Described')
      const renderer = makeRenderer(ws)
      try {
        const view = getHandleView(ws.nodes[0]!.getHandle('out')!)!

        view.group.fire('mouseenter')
        vi.advanceTimersByTime(TOOLTIP_DELAY)
        assertVisible('The numeric output value')

        ws.events.emit('coord:changed', ws.coord)
        assertHidden()
      } finally {
        renderer.dispose()
      }
    } finally {
      disposeTooltip()
      vi.useRealTimers()
    }
  })

  it('does not create a tooltip for handles without a description', () => {
    vi.useFakeTimers()
    try {
      const ws = new Workspace()
      ws.registerNodeSchema({
        type: 'Plain',
        name: 'Plain',
        handles: [
          {
            key: 'v',
            name: 'Value',
            accepts: 'number',
            position: HandlePosition.Right,
            value: 1,
          },
        ],
      })
      ws.addNode('Plain')
      const renderer = makeRenderer(ws)
      try {
        const view = getHandleView(ws.nodes[0]!.getHandle('v')!)!

        view.group.fire('mouseenter')
        vi.advanceTimersByTime(TOOLTIP_DELAY)
        expect(tooltipEl()).toBeNull()
      } finally {
        renderer.dispose()
      }
    } finally {
      disposeTooltip()
      vi.useRealTimers()
    }
  })
})