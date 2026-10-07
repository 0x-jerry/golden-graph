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
  it('positions the tooltip at the handle row for left and right handles', () => {
    vi.useFakeTimers()
    try {
      const ws = new Workspace()
      ws.registerNodeSchema(describedSchema)
      const node = ws.addNode('Described')
      node.moveTo(100, 100)
      const renderer = makeRenderer(ws)
      try {
        const show = (key: 'in' | 'out') => {
          const view = getHandleView(node.getHandle(key)!)!
          const abs = view._joint!.getAbsolutePosition()

          // First show creates the element while jsdom reports size 0; hide it,
          // mock real dimensions, then re-show to exercise the alignment math.
          view.group.fire('mouseover')
          vi.advanceTimersByTime(TOOLTIP_DELAY)
          mockTooltipSize(150, 30)
          view.group.fire('mouseleave')
          vi.advanceTimersByTime(TOOLTIP_DELAY)

          view.group.fire('mouseover')
          vi.advanceTimersByTime(TOOLTIP_DELAY)
          return { abs, el: tooltipEl()! }
        }

        // Right handle: tooltip grows leftward from the joint (right edge at
        // the joint), sitting over the handle instead of off the node's side.
        const right = show('out')
        expect(parseFloat(right.el.style.left)).toBeCloseTo(
          10 + right.abs.x - 150,
          0,
        )
        expect(parseFloat(right.el.style.top)).toBeLessThan(20 + right.abs.y)
        disposeTooltip()

        // Left handle: left edge at the joint, extending right over the handle.
        const left = show('in')
        expect(parseFloat(left.el.style.left)).toBeCloseTo(10 + left.abs.x, 0)
        expect(parseFloat(left.el.style.top)).toBeLessThan(20 + left.abs.y)
      } finally {
        renderer.dispose()
      }
    } finally {
      disposeTooltip()
      vi.useRealTimers()
    }
  })

  it('shows/hides on the hover delay and skips handles without a description', () => {
    vi.useFakeTimers()
    try {
      const ws = new Workspace()
      ws.registerNodeSchema(describedSchema)
      ws.addNode('Described')
      const renderer = makeRenderer(ws)
      try {
        const view = getHandleView(ws.nodes[0]!.getHandle('out')!)!

        assertHidden()

        view.group.fire('mouseover')
        assertHidden()
        vi.advanceTimersByTime(TOOLTIP_DELAY)
        assertVisible('The numeric output value')

        view.group.fire('mouseleave')
        assertVisible('The numeric output value')
        vi.advanceTimersByTime(TOOLTIP_DELAY)
        assertHidden()
      } finally {
        renderer.dispose()
      }
      disposeTooltip()

      const plain = new Workspace()
      plain.registerNodeSchema({
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
      plain.addNode('Plain')
      const plainRenderer = makeRenderer(plain)
      try {
        const plainView = getHandleView(plain.nodes[0]!.getHandle('v')!)!
        plainView.group.fire('mouseover')
        vi.advanceTimersByTime(TOOLTIP_DELAY)
        expect(tooltipEl()).toBeNull()
      } finally {
        plainRenderer.dispose()
      }
    } finally {
      disposeTooltip()
      vi.useRealTimers()
    }
  })
})
