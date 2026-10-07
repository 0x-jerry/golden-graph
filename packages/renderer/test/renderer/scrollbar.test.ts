import { afterEach, describe, it, expect, vi } from 'vitest'
import { Scrollbar } from '../../src/renderer/components/scroll'
import { makeStage } from '../helpers/stage'

describe('Scrollbar geometry', () => {
  it('sizes the thumb from the viewport/content ratio', () => {
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(0, 40, 10)
    expect(bar._thumb.height()).toBe(25)
    expect(bar._thumb.y()).toBe(0)
    bar.destroy()
  })

  it('round-trips a scroll position through the thumb', () => {
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(15, 40, 10)
    const y = bar._thumbYFor(15)
    expect(bar._scrollFromThumbY(y)).toBe(15)
    bar.destroy()
  })

  it('hides itself when the content fits', () => {
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(0, 5, 10)
    expect(bar.visible()).toBe(false)
    bar.show()
    expect(bar.visible()).toBe(false)
    bar.destroy()
  })

  it('pages toward the clicked side of the thumb', () => {
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(30, 40, 10)
    expect(bar._pageFromPointerY(0)).toBe(20)
    expect(bar._pageFromPointerY(99)).toBe(40)
    bar.destroy()
  })
})

describe('Scrollbar auto-hide', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('hides after the delay once flashed', () => {
    vi.useFakeTimers()
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(0, 40, 10)

    bar.flash()
    expect(bar.visible()).toBe(true)

    vi.advanceTimersByTime(600)
    expect(bar.visible()).toBe(false)
    bar.destroy()
  })

  it('does not hide while dragging', () => {
    vi.useFakeTimers()
    const { stage, layer } = makeStage()
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    layer.add(bar)
    bar.sync(0, 40, 10)

    bar._dragging = true
    bar.flash()
    vi.advanceTimersByTime(600)
    expect(bar.visible()).toBe(true)

    stage.destroy()
  })
})

describe('Scrollbar drag lifecycle', () => {
  it('ends the drag on a window mouseup (released outside the canvas)', () => {
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(0, 40, 10)

    bar._startDrag()
    expect(bar.dragging).toBe(true)

    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(bar.dragging).toBe(false)
    bar.destroy()
  })
})
