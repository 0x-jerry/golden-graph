import { describe, it, expect } from 'vitest'
import { createIncrementIdGenerator, isIntersected } from '../../src/core/helper'

describe('helper', () => {
  it('createIncrementIdGenerator works', () => {
    const gen = createIncrementIdGenerator()
    expect(gen.current()).toBe(0)
    expect(gen.next()).toBe(1)
    expect(gen.next()).toBe(2)
    gen.reset(10)
    expect(gen.current()).toBe(10)
    expect(gen.next()).toBe(11)
  })

  it('isIntersected with default comparator', () => {
    expect(isIntersected([1, 2], [3, 4])).toBe(false)
    expect(isIntersected([1, 2], [2, 4])).toBe(true)
  })

  it('isIntersected with custom comparator', () => {
    const a = [{ x: 1 }, { x: 2 }]
    const b = [{ x: 3 }, { x: 2 }]
    const eq = (u: { x: number }, v: { x: number }) => u.x === v.x
    expect(isIntersected(a, b, eq)).toBe(true)
  })
})

