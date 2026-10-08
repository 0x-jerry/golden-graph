import { afterEach, describe, it, expect, vi } from 'vitest'
import { Select } from '../../src/renderer/components/select'
import { SCROLLBAR_FADE_MS } from '../../src/renderer/animations'
import { makeStage } from '../helpers/stage'

function openSelect(count: number, maxVisibleItems = 4, animations = true) {
  const { stage, layer } = makeStage()
  const select = new Select({
    selectWidth: 120,
    options: Array.from({ length: count }, (_, i) => `opt-${i}`),
    maxVisibleItems,
    animations,
  })
  layer.add(select)
  select._openDropdown()
  return { stage, select }
}

describe('select dropdown scrollbar', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is absent when options fit and starts hidden when they overflow', () => {
    const fitting = openSelect(3)
    expect(fitting.select._dropdown!._scrollbar).toBe(null)
    fitting.stage.destroy()

    const overflowing = openSelect(10)
    const bar = overflowing.select._dropdown!._scrollbar!
    expect(bar).toBeTruthy()
    expect(bar.visible()).toBe(false)
    expect(bar._thumb.height()).toBeGreaterThan(0)
    overflowing.stage.destroy()
  })

  it('shows on hover, hides on leave, and follows wheel scrolling', () => {
    vi.useFakeTimers()
    const { stage, select } = openSelect(10)
    const dropdown = select._dropdown!
    const bar = dropdown._scrollbar!

    dropdown.fire('mouseenter')
    expect(bar.visible()).toBe(true)

    dropdown.fire('mouseleave')
    vi.advanceTimersByTime(600)
    // The auto-hide timer starts the fade-out; it settles a fade later.
    expect(bar.visible()).toBe(true)
    vi.advanceTimersByTime(SCROLLBAR_FADE_MS)
    expect(bar.visible()).toBe(false)
    vi.useRealTimers()

    dropdown.fire('wheel', { evt: { preventDefault() {}, deltaY: 10 } }, true)
    expect(dropdown.scrollTop).toBeGreaterThan(0)
    expect(dropdown.scrollTop).toBeLessThan(1)

    const big = openSelect(10)
    const bigDropdown = big.select._dropdown!
    const bigBar = bigDropdown._scrollbar!
    const before = bigBar._thumb.y()
    bigDropdown.fire(
      'wheel',
      { evt: { preventDefault() {}, deltaY: 100 } },
      true,
    )
    expect(bigDropdown.scrollTop).toBe(1)
    expect(bigBar._thumb.y()).toBeGreaterThan(before)
    big.stage.destroy()
    stage.destroy()
  })

  it('snaps its scrollbar when animations are off', () => {
    vi.useFakeTimers()
    const { stage, select } = openSelect(10, 4, false)
    const dropdown = select._dropdown!
    const bar = dropdown._scrollbar!

    dropdown.fire('mouseenter')
    expect(bar.visible()).toBe(true)
    expect(bar.opacity()).toBe(1)

    dropdown.fire('mouseleave')
    vi.advanceTimersByTime(600)
    expect(bar.visible()).toBe(false)
    expect(bar.opacity()).toBe(0)
    stage.destroy()
  })
})
