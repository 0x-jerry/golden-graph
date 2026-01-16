import { describe, it, expect } from 'vitest'
import { RectBox } from '../../src/utils/RectBox'

describe('RectBox', () => {
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

