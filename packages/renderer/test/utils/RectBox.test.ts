import { describe, it, expect } from 'vitest'
import { RectBox } from '../../src/utils/RectBox'

describe('RectBox', () => {
  it('fromRectBox', () => {
    const r = RectBox.fromRectBox({ left: 0, top: 0, right: 10, bottom: 20 })
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
    expect(r.width).toBe(10)
    expect(r.height).toBe(20)
  })

  it('includes', () => {
    const outer = RectBox.fromRectBox({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
    })
    const inner = RectBox.fromRectBox({
      left: 10,
      top: 10,
      right: 30,
      bottom: 30,
    })
    expect(outer.includes(inner)).toBe(true)
    const outside = RectBox.fromRectBox({
      left: -10,
      top: -10,
      right: 30,
      bottom: 30,
    })
    expect(outer.includes(outside)).toBe(false)
  })
})
