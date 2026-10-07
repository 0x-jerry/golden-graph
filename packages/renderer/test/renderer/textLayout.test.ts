import { describe, it, expect } from 'vitest'
import { buildTextLayout } from '../../src/renderer/components/text'

const measure = (s: string) => s.length * 10

function layout(text: string, width: number, lineHeight = 20) {
  return buildTextLayout({ text, width, lineHeight, measure })
}

describe('buildTextLayout', () => {
  it('breaks long words, wraps on spaces, honours newlines and empty text', () => {
    const long = layout('abcdef', 30)
    expect(long.lines.map((x) => x.text)).toEqual(['abc', 'def'])
    expect(long.height).toBe(40)

    const spaced = layout('aa bb cc', 50)
    expect(spaced.lines.map((x) => x.text)).toEqual(['aa bb', 'cc'])

    const nl = layout('a\nb', 100)
    expect(nl.lines.map((x) => x.text)).toEqual(['a', 'b'])
    expect(nl.lines[0]).toEqual({ start: 0, end: 1, text: 'a' })
    expect(nl.lines[1]).toEqual({ start: 2, end: 3, text: 'b' })

    const empty = layout('', 100)
    expect(empty.lines).toEqual([{ start: 0, end: 0, text: '' }])
  })

  it('maps offsets and points across line boundaries', () => {
    const l = layout('abcdef', 30)
    expect(l.pointAt(1)).toEqual({ line: 0, x: 10 })
    expect(l.pointAt(4)).toEqual({ line: 1, x: 10 })

    // a soft-wrap boundary offset belongs to the next line
    expect(l.pointAt(3)).toEqual({ line: 1, x: 0 })
    expect(l.pointAt(6)).toEqual({ line: 1, x: 30 })

    // a newline gap offset stays on the preceding line
    const nl = layout('a\nb', 100)
    expect(nl.pointAt(1)).toEqual({ line: 0, x: 10 })
    expect(nl.pointAt(2)).toEqual({ line: 1, x: 0 })

    expect(l.offsetAt(0, 0)).toBe(0)
    expect(l.offsetAt(22, 0)).toBe(2)
    expect(l.offsetAt(999, 1)).toBe(6)

    expect(l.lineAtY(0)).toBe(0)
    expect(l.lineAtY(25)).toBe(1)
    expect(l.lineAtY(999)).toBe(1)
  })
})
