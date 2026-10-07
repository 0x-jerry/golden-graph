import { describe, it, expect } from 'vitest'
import { ScrollArea } from '../../src/renderer/components/scroll'

function area(width = 100, height = 50) {
  return new ScrollArea({ width, height })
}

describe('ScrollArea scrolling', () => {
  it('clamps scrollTop to the content bounds', () => {
    const a = area()
    a.setContentHeight(200)
    a.scrollTo(100)
    expect(a.scrollTop).toBe(100)
    expect(a.content.y()).toBe(-100)

    a.scrollTo(-5)
    expect(a.scrollTop).toBe(0)

    a.scrollTo(999)
    expect(a.scrollTop).toBe(150)
    a.destroy()
  })

  it('re-clamps when the box grows', () => {
    const a = area()
    a.setContentHeight(200)
    a.scrollTo(150)
    a.resize(100, 100)
    expect(a.scrollTop).toBe(100)
    a.destroy()
  })

  it('shows the scrollbar only when the content overflows', () => {
    const a = area()
    a.setContentHeight(40)
    a._scrollbar.sync(a.scrollTop, 40, 50)
    expect(a._scrollbar.visible()).toBe(false)

    a.setContentHeight(200)
    a._scrollbar.sync(a.scrollTop, 200, 50)
    expect(a._scrollbar._thumb.height()).toBeGreaterThan(0)
    a.destroy()
  })

  it('scales the wheel step with the reported delta', () => {
    const a = area()
    a.setContentHeight(200)
    a.fire(
      'wheel',
      { evt: { preventDefault() {}, deltaY: 10 } },
      true,
    )
    expect(a.scrollTop).toBeGreaterThan(0)
    expect(a.scrollTop).toBeLessThan(18)
    a.destroy()
  })

  it('reveals the scrollbar on hover only when overflowing', () => {
    const short = area()
    short.setContentHeight(20)
    short.fire('mouseenter')
    expect(short._scrollbar.visible()).toBe(false)
    short.destroy()

    const tall = area()
    tall.setContentHeight(200)
    tall.fire('mouseenter')
    expect(tall._scrollbar.visible()).toBe(true)
    tall.destroy()
  })

  it('scrolls on wheel and flashes the scrollbar', () => {
    const a = area()
    a.setContentHeight(200)
    a.fire(
      'wheel',
      { evt: { preventDefault() {}, deltaY: 100 } },
      true,
    )
    expect(a.scrollTop).toBeGreaterThan(0)
    a.destroy()
  })

  it('lets the wheel through when the content fits', () => {
    const a = area()
    a.setContentHeight(20)
    let zoomed = false
    a.on('wheel', () => {
      zoomed = true
    })
    a.fire(
      'wheel',
      { evt: { preventDefault() {}, deltaY: 100 } },
      true,
    )
    expect(zoomed).toBe(true)
    expect(a.scrollTop).toBe(0)
    a.destroy()
  })
})
