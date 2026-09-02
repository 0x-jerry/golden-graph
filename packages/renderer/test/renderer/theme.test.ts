import { describe, it, expect } from 'vitest'
import type Konva from 'konva'
import { KonvaGraphRenderer } from '../../src/renderer'
import { DEFAULT_THEME } from '../../src/theme'
import { createWorkspace, groupNodes } from '../helpers/workspace'

function makeContainer() {
  const c = document.createElement('div')
  Object.defineProperty(c, 'clientWidth', { value: 800 })
  Object.defineProperty(c, 'clientHeight', { value: 600 })
  return c
}

describe('renderer theme', () => {
  it('applies a construction-time theme to live views', () => {
    const ws = createWorkspace()
    const n = ws.addNode('Number')
    n.moveTo(10, 10)

    const renderer = new KonvaGraphRenderer(makeContainer(), ws, {
      theme: { colors: { bg: '#111111' } },
    })
    try {
      const body = renderer.stage.findOne<Konva.Rect>('.body')!
      expect(body.fill()).toBe('#111111')
      expect(renderer.theme.colors.accent).toBe(DEFAULT_THEME.colors.accent)
    } finally {
      renderer.dispose()
    }
  })

  it('hot-swaps colors/fonts in place via setTheme', () => {
    const ws = createWorkspace()
    const n = ws.addNode('Number')
    n.moveTo(10, 10)

    const renderer = new KonvaGraphRenderer(makeContainer(), ws)
    try {
      const body = renderer.stage.findOne<Konva.Rect>('.body')!
      expect(body.fill()).toBe(DEFAULT_THEME.colors.bg)

      renderer.setTheme({
        colors: { bg: '#222222', accent: '#ff0000' },
        fonts: { family: 'monospace' },
      })

      expect(body.fill()).toBe('#222222')
      const name = renderer.stage.findOne<Konva.Text>('.name')!
      expect(name.fontFamily()).toBe('monospace')
    } finally {
      renderer.dispose()
    }
  })

  it('re-applies the theme across node, group, edge, handle and caret chrome', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    const b = ws.addNode('Sum')
    a.moveTo(10, 10)
    b.moveTo(300, 10)
    groupNodes(ws, a.id, b.id)
    ws.connect(a.getHandle('value')!, b.getHandle('a')!)

    const renderer = new KonvaGraphRenderer(makeContainer(), ws, {
      theme: { fonts: { size: 14 } },
    })
    try {
      const name = renderer.stage.findOne<Konva.Text>('.name')!
      expect(name.fontSize()).toBe(15)
      const label = renderer.stage.findOne<Konva.Text>('.label')!
      expect(label.fontSize()).toBe(14)

      renderer.setTheme({
        colors: {
          bg: '#111111',
          textLabel: '#00ff00',
          textMuted: '#0000ff',
          groupBg: '#222222',
        },
        fonts: { size: 16 },
      })

      // Layer order is group → edge → node, so the first `.body` is the
      // group's and the second the first node's.
      const bodies = renderer.stage.find<Konva.Rect>('.body')
      expect(bodies[0]!.fill()).toBe('#222222')
      expect(bodies[1]!.fill()).toBe('#111111')

      const groupName = renderer.stage.findOne<Konva.Text>('.name')!
      expect(groupName.fontSize()).toBe(17)
      expect(name.fontSize()).toBe(17)

      // Handle label + centering survive the swap.
      expect(label.fill()).toBe('#00ff00')
      expect(label.fontSize()).toBe(16)
      expect(label.offsetY()).toBe(label.height() / 2)

      // Edge close button and caret chevron re-theme.
      const close = renderer.stage.findOne<Konva.Group>('.edge-close')!
      const circle = close.getChildren()[0] as Konva.Rect
      expect(circle.fill()).toBe('#111111')
      const caret = renderer.stage.findOne<Konva.Group>('.caret')!
      const chevron = caret.getChildren()[0] as Konva.Line
      expect(chevron.stroke()).toBe('#0000ff')
    } finally {
      renderer.dispose()
    }
  })

  it('re-applies theme to edges', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    const b = ws.addNode('Sum')
    a.moveTo(10, 10)
    b.moveTo(300, 10)
    ws.connect(a.getHandle('value')!, b.getHandle('a')!)

    const renderer = new KonvaGraphRenderer(makeContainer(), ws, {
      theme: { metrics: { edgeWidth: 5 } },
    })
    try {
      const line = renderer.stage.findOne<Konva.Line>('.edge-line')!
      expect(line.strokeWidth()).toBe(5)
      renderer.setTheme({ metrics: { edgeWidth: 2 } })
      expect(line.strokeWidth()).toBe(2)
    } finally {
      renderer.dispose()
    }
  })
})
