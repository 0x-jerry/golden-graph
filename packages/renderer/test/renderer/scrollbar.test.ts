import { afterEach, describe, it, expect, vi } from 'vitest'
import { Scrollbar } from '../../src/renderer/components/scroll'
import { SCROLLBAR_FADE_MS } from '../../src/renderer/animations'
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
    // The auto-hide timer starts the fade-out; the overlay is still on screen
    // (and answering no pointers) until that fade settles.
    expect(bar.visible()).toBe(true)
    expect(bar.listening()).toBe(false)
    vi.advanceTimersByTime(SCROLLBAR_FADE_MS)
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

describe('Scrollbar fade', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fades in on show and out before hiding', () => {
    vi.useFakeTimers()
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(0, 40, 10)
    expect(bar.opacity()).toBe(0)
    expect(bar.listening()).toBe(false)

    bar.show()
    expect(bar.visible()).toBe(true)
    expect(bar.listening()).toBe(true)
    // Still transparent: the first frame has not run yet.
    expect(bar.opacity()).toBeLessThan(1)
    vi.advanceTimersByTime(SCROLLBAR_FADE_MS)
    expect(bar.opacity()).toBe(1)
    expect(bar._fadeAnim).toBe(null)

    bar.hide()
    // Mid-fade the overlay is still on screen but no longer interactive.
    expect(bar.visible()).toBe(true)
    expect(bar.opacity()).toBe(1)
    expect(bar.listening()).toBe(false)
    vi.advanceTimersByTime(SCROLLBAR_FADE_MS)
    expect(bar.visible()).toBe(false)
    expect(bar.opacity()).toBe(0)
    expect(bar.listening()).toBe(false)
    bar.destroy()
  })

  it('reverses an in-flight fade from its current opacity', () => {
    vi.useFakeTimers()
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(0, 40, 10)

    bar.show()
    vi.advanceTimersByTime(SCROLLBAR_FADE_MS / 2)
    const mid = bar.opacity()
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)

    bar.hide()
    vi.advanceTimersByTime(SCROLLBAR_FADE_MS)
    expect(bar.visible()).toBe(false)
    expect(bar.opacity()).toBe(0)

    bar.show()
    vi.advanceTimersByTime(SCROLLBAR_FADE_MS)
    expect(bar.visible()).toBe(true)
    expect(bar.opacity()).toBe(1)
    bar.destroy()
  })

  it('keeps the fade in flight when show/hide repeats the same target', () => {
    vi.useFakeTimers()
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(0, 40, 10)

    bar.flash()
    vi.advanceTimersByTime(10)
    const anim = bar._fadeAnim
    bar.show()
    bar.flash()
    expect(bar._fadeAnim).toBe(anim)
    bar.destroy()
  })

  it('snaps both ways when animations are off', () => {
    vi.useFakeTimers()
    const bar = new Scrollbar({
      trackHeight: 100,
      animations: false,
      onScroll: () => {},
    })
    bar.sync(0, 40, 10)

    bar.show()
    expect(bar.visible()).toBe(true)
    expect(bar.opacity()).toBe(1)
    expect(bar._fadeAnim).toBe(null)

    bar.hide()
    expect(bar.visible()).toBe(false)
    expect(bar.opacity()).toBe(0)

    bar.flash()
    vi.advanceTimersByTime(600)
    expect(bar.visible()).toBe(false)
    bar.destroy()
  })

  it('drops to hidden at once when the content stops overflowing', () => {
    vi.useFakeTimers()
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(0, 40, 10)
    bar.show()
    vi.advanceTimersByTime(SCROLLBAR_FADE_MS / 2)

    bar.sync(0, 5, 10)
    expect(bar.visible()).toBe(false)
    expect(bar.opacity()).toBe(0)
    expect(bar._fadeAnim).toBe(null)
    bar.destroy()
  })

  it('cancels a fade in flight when destroyed', () => {
    vi.useFakeTimers()
    const bar = new Scrollbar({ trackHeight: 100, onScroll: () => {} })
    bar.sync(0, 40, 10)
    bar.show()
    bar.destroy()

    expect(bar._fadeAnim).toBe(null)
    expect(() => vi.advanceTimersByTime(SCROLLBAR_FADE_MS * 2)).not.toThrow()
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
