import { afterEach, describe, it, expect, vi } from 'vitest'
import { Scrollbar } from '../../src/renderer/components/scroll'
import { makeStage } from '../helpers/stage'

describe('Scrollbar geometry', () => {
  it('sizes the thumb from the viewport/content ratio and round-trips scroll', () => {
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(0, 40, 10)
    expect(bar._thumb.height()).toBe(25)
    expect(bar._thumb.y()).toBe(0)

    bar.sync(15, 40, 10)
    const y = bar._thumbYFor(15)
    expect(bar._scrollFromThumbY(y)).toBe(15)
    bar.destroy()
  })

  it('hides itself when the content fits and pages toward the clicked side', () => {
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(0, 5, 10)
    expect(bar.visible()).toBe(false)
    bar.show()
    expect(bar.visible()).toBe(false)

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

  it('hides after the delay once flashed, unless dragging', () => {
    vi.useFakeTimers()
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(0, 40, 10)

    bar.flash()
    expect(bar.visible()).toBe(true)
    vi.advanceTimersByTime(600)
    expect(bar.visible()).toBe(false)
    bar.destroy()

    const { stage, layer } = makeStage()
    const drag = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    layer.add(drag)
    drag.sync(0, 40, 10)
    drag._dragging = true
    drag.flash()
    vi.advanceTimersByTime(600)
    expect(drag.visible()).toBe(true)
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
