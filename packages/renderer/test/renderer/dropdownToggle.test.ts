import { afterEach, describe, it, expect, vi } from 'vitest'
import Konva from 'konva'
import { Select } from '../../src/renderer/components/select'
import { KonvaGraphRenderer } from '../../src/renderer'
import {
  DROPDOWN_SLIDE_PX,
  DROPDOWN_TOGGLE_MS,
} from '../../src/renderer/animations'
import { makeStage } from '../helpers/stage'
import { createWorkspace } from '../helpers/workspace'

function openSelect(animations = true, count = 10) {
  const { stage, layer } = makeStage()
  const select = new Select({
    selectWidth: 120,
    options: Array.from({ length: count }, (_, i) => `opt-${i}`),
    maxVisibleItems: 4,
    animations,
  })
  layer.add(select)
  select._openDropdown()
  return { stage, select }
}

/**
 * A select sitting in a scaled, translated host — as a handle widget inside a
 * node is. Returns the absolute y the panel rests at: directly under the box.
 */
function nestedSelect(animations = true) {
  const { stage, layer } = makeStage()
  const host = new Konva.Group({ x: 40, y: 300, scaleX: 2, scaleY: 2 })
  const select = new Select({
    selectWidth: 120,
    selectHeight: 18,
    options: Array.from({ length: 10 }, (_, i) => `opt-${i}`),
    maxVisibleItems: 4,
    animations,
  })
  host.add(select)
  layer.add(host)
  const origin = select.getAbsolutePosition()
  return {
    stage,
    layer,
    select,
    restX: origin.x,
    // Panel y inside the select is `hostHeight + 2`, in select-local units.
    restY: origin.y + (18 + 2) * 2,
  }
}

describe('select dropdown toggle', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('slides the panel in from its select and lands at rest', () => {
    vi.useFakeTimers()
    const { stage, select } = openSelect()
    const panel = select._dropdown!

    // Mounted at the hidden end of the transition, so the mount draw cannot
    // flash the panel at full opacity.
    expect(panel.opacity()).toBe(0)
    expect(panel._restY - panel.y()).toBeCloseTo(DROPDOWN_SLIDE_PX, 5)

    vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)
    expect(panel.opacity()).toBe(1)
    expect(panel.y()).toBe(panel._restY)
    stage.destroy()
  })

  it('fades the panel out and destroys it once the close settles', () => {
    vi.useFakeTimers()
    const { stage, select } = openSelect()
    const panel = select._dropdown!
    vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)

    select.deactivate()
    // Handed over to the close transition: no longer the live panel, but still
    // on the layer and no longer interactive.
    expect(select._dropdown).toBe(null)
    expect(select._closingDropdown).toBe(panel)
    expect(panel.getParent()).not.toBe(null)
    expect(panel.listening()).toBe(false)
    expect(panel.opacity()).toBe(1)

    vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)
    expect(select._closingDropdown).toBe(null)
    expect(panel.getParent()).toBe(null)
    stage.destroy()
  })

  it('opens and closes instantly when animations are off', () => {
    const { stage, select } = openSelect(false)
    const panel = select._dropdown!

    expect(panel.opacity()).toBe(1)
    expect(panel.y()).toBe(panel._restY)

    select.deactivate()
    expect(select._dropdown).toBe(null)
    expect(select._closingDropdown).toBe(null)
    expect(panel.getParent()).toBe(null)
    stage.destroy()
  })

  it('replaces a still-closing panel when the select reopens', () => {
    vi.useFakeTimers()
    const { stage, select } = openSelect()
    const first = select._dropdown!
    vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)

    select.deactivate()
    select._openDropdown()

    expect(select._closingDropdown).toBe(null)
    expect(first.getParent()).toBe(null)
    expect(select._dropdown).not.toBe(first)

    vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)
    expect(select._dropdown!.opacity()).toBe(1)
    stage.destroy()
  })

  it('does not replay the transition when the open panel is re-mounted', () => {
    vi.useFakeTimers()
    const { stage, select } = openSelect()
    vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)

    // `setValue` re-mounts the panel while it is open (e.g. width/value change).
    select.setValue('opt-3')
    const panel = select._dropdown!
    expect(panel.opacity()).toBe(1)
    expect(panel.y()).toBe(panel._restY)
    stage.destroy()
  })

  it('kills a closing panel with the select', () => {
    vi.useFakeTimers()
    const { stage, select } = openSelect()
    const panel = select._dropdown!
    vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)

    select.deactivate()
    select.destroy()

    expect(select._closingDropdown).toBe(null)
    expect(panel.getParent()).toBe(null)
    expect(() => vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS * 2)).not.toThrow()
    stage.destroy()
  })

  it('rests the panel beside its select, not at the layer origin', () => {
    vi.useFakeTimers()
    const { stage, select, restX, restY } = nestedSelect()

    select._openDropdown()
    const panel = select._dropdown!
    // Mid-slide it is at most one slide-length away from its resting spot.
    expect(Math.abs(panel.getAbsolutePosition().y - restY)).toBeLessThanOrEqual(
      DROPDOWN_SLIDE_PX + 0.5,
    )

    vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)
    expect(panel.getAbsolutePosition().x).toBeCloseTo(restX, 5)
    expect(panel.getAbsolutePosition().y).toBeCloseTo(restY, 5)
    stage.destroy()
  })

  it('shows the panel again on the next click after it closed', () => {
    vi.useFakeTimers()
    const { stage, select, restX, restY } = nestedSelect()

    // Three real clicks: open, close, reopen.
    select._bg.fire('click')
    expect(select._dropdown).not.toBe(null)
    vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)

    select._bg.fire('click')
    expect(select._dropdown).toBe(null)
    vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)

    select._bg.fire('click')
    const reopened = select._dropdown
    expect(reopened).not.toBe(null)
    vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)
    expect(reopened!.opacity()).toBe(1)
    expect(reopened!.getAbsolutePosition().x).toBeCloseTo(restX, 5)
    expect(reopened!.getAbsolutePosition().y).toBeCloseTo(restY, 5)
    stage.destroy()
  })

  it('toggles the select handle of a rendered node at the node position', () => {
    vi.useFakeTimers()
    const ws = createWorkspace()
    ws.registerNodeSchema({
      type: 'Picker',
      name: 'Picker',
      handles: [
        {
          key: 'pick',
          name: 'Pick',
          type: 'select',
          options: { options: ['a', 'b', 'c'] },
        },
      ],
    })
    const node = ws.addNode('Picker')
    node.moveTo(500, 400)

    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })
    const renderer = new KonvaGraphRenderer(container, ws)
    try {
      const view = renderer._store._nodeViews.get(node.id)!
      const module = view._handleViews.get('pick')!._module! as unknown as {
        _select: Select
      }
      const select = module._select

      select._bg.fire('click')
      const panel = select._dropdown!
      vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)

      // The panel hangs directly under the box (18px tall + 2px gap).
      const box = select.getAbsolutePosition()
      expect(panel.getAbsolutePosition().x).toBeCloseTo(box.x, 5)
      expect(panel.getAbsolutePosition().y).toBeCloseTo(box.y + 20, 5)

      // Close and reopen through the same click path.
      select._bg.fire('click')
      vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)
      select._bg.fire('click')
      const reopened = select._dropdown!
      vi.advanceTimersByTime(DROPDOWN_TOGGLE_MS)
      expect(reopened.getAbsolutePosition().x).toBeCloseTo(box.x, 5)
      expect(reopened.getAbsolutePosition().y).toBeCloseTo(box.y + 20, 5)
      expect(reopened.opacity()).toBe(1)
    } finally {
      renderer.dispose()
    }
  })
})
