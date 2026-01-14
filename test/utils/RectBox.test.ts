import { describe, it, expect } from 'vitest'
import { RectBox } from '../../src/utils/RectBox'

describe('RectBox', () => {
  it('constructs and getters/setters work', () => {
    const r = new RectBox(10, 20, 30, 40)
    expect(r.left).toBe(10)
    expect(r.top).toBe(20)
    expect(r.right).toBe(40)
    expect(r.bottom).toBe(60)

    r.left = 5
    expect(r.x).toBe(5)
    r.top = 6
    expect(r.y).toBe(6)

    r.right = 50
    expect(r.width).toBe(45)

    r.bottom = 80
    expect(r.height).toBe(74)
  })

  it('fromRectBox', () => {
    const r = RectBox.fromRectBox(0, 0, 10, 20)
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
    expect(r.width).toBe(10)
    expect(r.height).toBe(20)
  })

  it('includes', () => {
    const outer = RectBox.fromRectBox(0, 0, 100, 100)
    const inner = RectBox.fromRectBox(10, 10, 30, 30)
    expect(outer.includes(inner)).toBe(true)
    const outside = RectBox.fromRectBox(-10, -10, 30, 30)
    expect(outer.includes(outside)).toBe(false)
  })
})

