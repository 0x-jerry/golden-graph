import { describe, it, expect } from 'vitest'
import { CoordSystem } from '../src'

describe('CoordSystem', () => {
  it('move applies inverse scale', () => {
    const c = new CoordSystem()
    c.zoomAt({ x: 0, y: 0 }, 2)
    expect(c.scale).toBe(2)
    c.move(10, 20)
    expect(c.origin.x).toBeCloseTo(5)
    expect(c.origin.y).toBeCloseTo(10)
  })

  it('zoomAt adjusts origin and scale', () => {
    const c = new CoordSystem()
    c.zoomAt({ x: 100, y: 100 }, 2)
    expect(c.scale).toBe(2)
    expect(c.origin.x).toBeCloseTo(-50)
    expect(c.origin.y).toBeCloseTo(-50)
  })

  it('convertToScreenCoord and convertScreenCoord are inverse', () => {
    const c = new CoordSystem()
    c.zoomAt({ x: 150, y: 50 }, 3)
    c.move(30, 60)
    const p = { x: 10, y: 20 }
    const screen = c.convertToScreenCoord(p)
    const back = c.convertScreenCoord(screen)
    expect(back.x).toBeCloseTo(p.x)
    expect(back.y).toBeCloseTo(p.y)
  })

  it('zoomAt keeps the anchor screen point fixed after a pan', () => {
    const c = new CoordSystem()
    c.move(30, 40)
    c.zoomAt({ x: 0, y: 0 }, 2)

    // `zoomAt` anchors screen coordinates (what the renderer passes in).
    const screen = { x: 200, y: 100 }
    const world = c.convertScreenCoord(screen)
    const before = c.convertToScreenCoord(world)

    c.zoomAt(screen, 3)

    const after = c.convertToScreenCoord(world)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })
})
