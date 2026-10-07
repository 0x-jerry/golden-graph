import { describe, it, expect } from 'vitest'
import { ScrollArea } from '../../src/renderer/components/scroll'

function area(width = 100, height = 50) {
  return new ScrollArea({ width, height })
}

describe('ScrollArea scrolling', () => {
  it('clamps scrollTop to content bounds and re-clamps when the box grows', () => {
    const a = area()
    a.setContentHeight(200)
    a.scrollTo(100)
    expect(a.scrollTop).toBe(100)
    expect(a.content.y()).toBe(-100)

    a.scrollTo(-5)
    expect(a.scrollTop).toBe(0)

    a.scrollTo(999)
    expect(a.scrollTop).toBe(150)

    a.resize(100, 100)
    expect(a.scrollTop).toBe(100)
    a.destroy()
  })

  it('shows the scrollbar only on overflow, including on hover', () => {
    const a = area()
    a.setContentHeight(40)
    a._scrollbar.sync(a.scrollTop, 40, 50)
    expect(a._scrollbar.visible()).toBe(false)
    a.fire('mouseenter')
    expect(a._scrollbar.visible()).toBe(false)

    a.setContentHeight(200)
    a._scrollbar.sync(a.scrollTop, 200, 50)
    expect(a._scrollbar._thumb.height()).toBeGreaterThan(0)
    a.fire('mouseenter')
    expect(a._scrollbar.visible()).toBe(true)
    a.destroy()
  })

  it('scrolls on wheel with the reported delta and lets it through when content fits', () => {
    const a = area()
    a.setContentHeight(200)
    a.fire('wheel', { evt: { preventDefault() {}, deltaY: 10 } }, true)
    expect(a.scrollTop).toBeGreaterThan(0)
    expect(a.scrollTop).toBeLessThan(18)

    a.scrollTo(0)
    a.fire('wheel', { evt: { preventDefault() {}, deltaY: 100 } }, true)
    expect(a.scrollTop).toBeGreaterThan(0)
    a.destroy()

    // No overflow → the wheel event is left for the canvas to zoom.
    const fits = area()
    fits.setContentHeight(20)
    let zoomed = false
    fits.on('wheel', () => {
      zoomed = true
    })
    fits.fire('wheel', { evt: { preventDefault() {}, deltaY: 100 } }, true)
    expect(zoomed).toBe(true)
    expect(fits.scrollTop).toBe(0)
    fits.destroy()
  })
})
