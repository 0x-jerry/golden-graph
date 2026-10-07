import { describe, it, expect } from 'vitest'
import { buildTextLayout } from '../../src/renderer/components/text'

const measure = (s: string) => s.length * 10

function layout(text: string, width: number, lineHeight = 20) {
  return buildTextLayout({ text, width, lineHeight, measure })
}

describe('buildTextLayout wrapping', () => {
  it('breaks words longer than the line by character', () => {
    const l = layout('abcdef', 30)
    expect(l.lines.map((x) => x.text)).toEqual(['abc', 'def'])
    expect(l.height).toBe(40)
  })

  it('wraps greedily on spaces', () => {
    const l = layout('aa bb cc', 50)
    expect(l.lines.map((x) => x.text)).toEqual(['aa bb', 'cc'])
  })

  it('starts a new line at explicit newlines', () => {
    const l = layout('a\nb', 100)
    expect(l.lines.map((x) => x.text)).toEqual(['a', 'b'])
    expect(l.lines[0]).toEqual({ start: 0, end: 1, text: 'a' })
    expect(l.lines[1]).toEqual({ start: 2, end: 3, text: 'b' })
  })

  it('emits one empty line for empty text', () => {
    const l = layout('', 100)
    expect(l.lines).toEqual([{ start: 0, end: 0, text: '' }])
  })
})

describe('buildTextLayout offset mapping', () => {
  it('maps an offset to a line-local x', () => {
    const l = layout('abcdef', 30)
    expect(l.pointAt(1)).toEqual({ line: 0, x: 10 })
    expect(l.pointAt(4)).toEqual({ line: 1, x: 10 })
  })

  it('puts a soft-wrap boundary offset on the next line', () => {
    const l = layout('abcdef', 30)
    expect(l.pointAt(3)).toEqual({ line: 1, x: 0 })
    expect(l.pointAt(6)).toEqual({ line: 1, x: 30 })
  })

  it('keeps gap offsets (newline) on the preceding line', () => {
    const l = layout('a\nb', 100)
    expect(l.pointAt(1)).toEqual({ line: 0, x: 10 })
    expect(l.pointAt(2)).toEqual({ line: 1, x: 0 })
  })

  it('maps a point back to the nearest offset', () => {
    const l = layout('abcdef', 30)
    expect(l.offsetAt(0, 0)).toBe(0)
    expect(l.offsetAt(22, 0)).toBe(2)
    expect(l.offsetAt(999, 1)).toBe(6)
  })

  it('clamps line lookups by y', () => {
    const l = layout('abcdef', 30, 20)
    expect(l.lineAtY(0)).toBe(0)
    expect(l.lineAtY(25)).toBe(1)
    expect(l.lineAtY(999)).toBe(1)
  })
})
