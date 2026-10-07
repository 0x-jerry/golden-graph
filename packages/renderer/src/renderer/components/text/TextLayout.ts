export interface TextLine {
  /** Offset of the line's first character in the source string. */
  start: number
  /** Offset just past the line's last character. */
  end: number
  text: string
}

export interface TextLayout {
  lines: TextLine[]
  lineHeight: number
  height: number
  pointAt(offset: number): { line: number; x: number }
  offsetAt(x: number, line: number): number
  lineAtY(y: number): number
}

export interface TextLayoutOptions {
  text: string
  width: number
  lineHeight: number
  measure: (text: string) => number
}

/**
 * Soft-word-wrap layout over a flat string. Lines carry offsets into the
 * source so the caret and selection can map between string positions and
 * box points. Explicit `\n` starts a new paragraph; each paragraph then wraps
 * greedily on spaces, breaking words longer than the line by character.
 */
export function buildTextLayout(options: TextLayoutOptions): TextLayout {
  const { text, width, lineHeight, measure } = options
  const lines: TextLine[] = []

  let paraStart = 0
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      wrapParagraph(text, paraStart, i, width, measure, lines)
      paraStart = i + 1
    }
  }

  return {
    lines,
    lineHeight,
    height: lines.length * lineHeight,
    pointAt(offset) {
      const clamped = Math.max(0, Math.min(text.length, offset))
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        const next = lines[i + 1]
        // At a soft wrap the next line starts where this one ends, so the
        // boundary offset belongs to the next line. A hard break (newline) or
        // a dropped space leaves a gap and keeps the offset on this line.
        const softWrap = next !== undefined && next.start === line.end
        if (clamped < line.end || (clamped === line.end && !softWrap)) {
          return { line: i, x: measure(line.text.slice(0, clamped - line.start)) }
        }
      }
      const last = lines[lines.length - 1]!
      return { line: lines.length - 1, x: measure(last.text) }
    },
    offsetAt(x, line) {
      const target = lines[Math.max(0, Math.min(lines.length - 1, line))]
      if (!target) return 0
      if (x <= 0) return target.start
      for (let i = 0; i < target.text.length; i++) {
        const before = measure(target.text.slice(0, i))
        const after = measure(target.text.slice(0, i + 1))
        if (x < (before + after) / 2) return target.start + i
      }
      return target.end
    },
    lineAtY(y) {
      return Math.max(
        0,
        Math.min(lines.length - 1, Math.floor(y / lineHeight)),
      )
    },
  }
}

function wrapParagraph(
  text: string,
  start: number,
  end: number,
  width: number,
  measure: (text: string) => number,
  lines: TextLine[],
): void {
  if (start >= end) {
    lines.push({ start, end: start, text: '' })
    return
  }

  let lineStart = start
  let pos = start
  let lastSpace = -1

  while (pos < end) {
    const ch = text[pos]!
    if (ch === ' ') {
      if (measure(text.slice(lineStart, pos)) <= width) {
        lastSpace = pos
      }
    }
    if (measure(text.slice(lineStart, pos + 1)) <= width) {
      pos++
      continue
    }
    // The next character overflows the line: break at the last space, or by
    // character when a single word is wider than the box.
    if (lastSpace > lineStart) {
      lines.push({
        start: lineStart,
        end: lastSpace,
        text: text.slice(lineStart, lastSpace),
      })
      lineStart = lastSpace + 1
    } else {
      const breakEnd = Math.max(lineStart + 1, pos)
      lines.push({
        start: lineStart,
        end: breakEnd,
        text: text.slice(lineStart, breakEnd),
      })
      lineStart = breakEnd
    }
    pos = lineStart
    lastSpace = -1
  }

  lines.push({ start: lineStart, end, text: text.slice(lineStart, end) })
}
