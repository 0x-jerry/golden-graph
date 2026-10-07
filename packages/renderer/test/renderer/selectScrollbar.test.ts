import { afterEach, describe, it, expect, vi } from 'vitest'
import { Select } from '../../src/renderer/components/select'
import { makeStage } from '../helpers/stage'

function openSelect(count: number, maxVisibleItems = 4) {
  const { stage, layer } = makeStage()
  const select = new Select({
    selectWidth: 120,
    options: Array.from({ length: count }, (_, i) => `opt-${i}`),
    maxVisibleItems,
  })
  layer.add(select)
  select._openDropdown()
  return { stage, select }
}

describe('select dropdown scrollbar', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is absent when the options fit', () => {
    const { stage, select } = openSelect(3)
    expect(select._dropdown!._scrollbar).toBe(null)
    stage.destroy()
  })

  it('exists but starts hidden when options overflow', () => {
    const { stage, select } = openSelect(10)
    const bar = select._dropdown!._scrollbar!
    expect(bar).toBeTruthy()
    expect(bar.visible()).toBe(false)
    expect(bar._thumb.height()).toBeGreaterThan(0)
    stage.destroy()
  })

  it('shows on hover and hides after leaving', () => {
    vi.useFakeTimers()
    const { stage, select } = openSelect(10)
    const dropdown = select._dropdown!
    const bar = dropdown._scrollbar!

    dropdown.fire('mouseenter')
    expect(bar.visible()).toBe(true)

    dropdown.fire('mouseleave')
    vi.advanceTimersByTime(600)
    expect(bar.visible()).toBe(false)
    stage.destroy()
  })

  it('scales the wheel step with the reported delta', () => {
    const { stage, select } = openSelect(10)
    const dropdown = select._dropdown!
    dropdown.fire(
      'wheel',
      { evt: { preventDefault() {}, deltaY: 10 } },
      true,
    )
    expect(dropdown.scrollTop).toBeGreaterThan(0)
    expect(dropdown.scrollTop).toBeLessThan(1)
    stage.destroy()
  })

  it('moves the thumb with wheel scrolling', () => {
    const { stage, select } = openSelect(10)
    const dropdown = select._dropdown!
    const bar = dropdown._scrollbar!

    const before = bar._thumb.y()
    dropdown.fire(
      'wheel',
      { evt: { preventDefault() {}, deltaY: 100 } },
      true,
    )
    expect(dropdown.scrollTop).toBe(1)
    expect(bar._thumb.y()).toBeGreaterThan(before)
    stage.destroy()
  })
})
