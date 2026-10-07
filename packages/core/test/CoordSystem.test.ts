import { describe, it, expect } from 'vitest'
import { CoordSystem } from '../src'

describe('CoordSystem', () => {
  it('move applies the inverse scale and screen/world conversion is inverse', () => {
    const c = new CoordSystem()
    c.zoomAt({ x: 0, y: 0 }, 2)
    expect(c.scale).toBe(2)
    c.move(10, 20)
    expect(c.origin.x).toBeCloseTo(5)
    expect(c.origin.y).toBeCloseTo(10)

    const p = { x: 10, y: 20 }
    const screen = c.convertToScreenCoord(p)
    const back = c.convertScreenCoord(screen)
    expect(back.x).toBeCloseTo(p.x)
    expect(back.y).toBeCloseTo(p.y)
  })

  it('zoomAt adjusts origin/scale and keeps the anchor screen point fixed', () => {
    const c = new CoordSystem()
    c.zoomAt({ x: 100, y: 100 }, 2)
    expect(c.scale).toBe(2)
    expect(c.origin.x).toBeCloseTo(-50)
    expect(c.origin.y).toBeCloseTo(-50)

    const c2 = new CoordSystem()
    c2.move(30, 40)
    c2.zoomAt({ x: 0, y: 0 }, 2)

    // `zoomAt` anchors screen coordinates (what the renderer passes in).
    const screen = { x: 200, y: 100 }
    const world = c2.convertScreenCoord(screen)
    const before = c2.convertToScreenCoord(world)

    c2.zoomAt(screen, 3)

    const after = c2.convertToScreenCoord(world)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })
})
