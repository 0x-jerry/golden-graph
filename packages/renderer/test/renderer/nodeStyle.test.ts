import { describe, it, expect } from 'vitest'
import Konva from 'konva'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { addHandle, makeNode } from '../helpers/entities'
import { find } from '../helpers/konva'
import { NodeView } from '../../src/renderer/NodeView'
import { KonvaGraphRenderer } from '../../src/renderer'
import { createWorkspace, groupNodes } from '../helpers/workspace'
import { LAYOUT, NODE_BODY_STROKE_WIDTH } from '../../src/renderer/constants'
import { DEFAULT_THEME } from '../../src/theme'
import type { DeepPartial, GraphTheme } from '../../src/theme'

function theme(patch: DeepPartial<GraphTheme>): GraphTheme {
  return {
    colors: { ...DEFAULT_THEME.colors, ...patch.colors },
    fonts: { ...DEFAULT_THEME.fonts, ...patch.fonts },
    metrics: { ...DEFAULT_THEME.metrics, ...patch.metrics },
  }
}

/** Path ops a joint's sceneFunc would draw, with a stub 2D context. */
function drawnCalls(shape: Konva.Shape): string[] {
  const calls: string[] = []
  const stub = new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        if (prop === 'fillStrokeShape') {
          return () => undefined
        }
        return (...args: unknown[]) => calls.push(`${prop}(${args.join(',')})`)
      },
    },
  )
  shape.getSceneFunc()(stub as Konva.Context, shape)
  return calls
}

describe('node body style', () => {
  it('insets a full-bleed header by the body stroke and inherits its top corners', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a', { type: 'number' })

    const view = new NodeView(
      node,
      theme({ metrics: { nodeCornerRadius: 12 } }),
    )
    const header = find<Konva.Rect>(view.group, '.header')

    // The band stops at the body outline, so the stroke stays visible.
    expect(header.x()).toBe(NODE_BODY_STROKE_WIDTH)
    expect(header.y()).toBe(NODE_BODY_STROKE_WIDTH)
    expect(header.width()).toBe(200 - NODE_BODY_STROKE_WIDTH * 2)
    expect(header.height()).toBe(
      LAYOUT.HEADER_HEIGHT - NODE_BODY_STROKE_WIDTH * 2,
    )
    expect(header.cornerRadius()).toEqual([12, 12, 0, 0])
  })

  it('insets the header band further and drops the inherited corners when asked', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a', { type: 'number' })

    const view = new NodeView(
      node,
      theme({
        metrics: {
          nodeCornerRadius: 12,
          headerInset: 4,
          headerCornerRadius: 6,
        },
      }),
    )
    const header = find<Konva.Rect>(view.group, '.header')

    const inset = 4 + NODE_BODY_STROKE_WIDTH
    expect(header.x()).toBe(inset)
    expect(header.y()).toBe(inset)
    expect(header.width()).toBe(200 - inset * 2)
    expect(header.height()).toBe(LAYOUT.HEADER_HEIGHT - inset * 2)
    expect(header.cornerRadius()).toBe(6)
  })

  it('ignores the header inset while collapsed (the node IS the band)', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a', { type: 'number' })

    const view = new NodeView(node, theme({ metrics: { headerInset: 4 } }))
    node.setCollapsed(true)
    view.update()

    const header = find<Konva.Rect>(view.group, '.header')
    expect(header.x()).toBe(NODE_BODY_STROKE_WIDTH)
    expect(header.height()).toBe(
      LAYOUT.HEADER_HEIGHT - NODE_BODY_STROKE_WIDTH * 2,
    )
  })

  it('rounds a collapsed band on all corners', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a', { type: 'number' })

    // Collapsed, the band IS the whole silhouette, so the body radius applies
    // to every corner (a numeric radius covers all four in Konva) instead of
    // only the top two.
    const view = new NodeView(
      node,
      theme({ metrics: { nodeCornerRadius: 14 } }),
    )
    node.setCollapsed(true)
    view.update()

    const header = find<Konva.Rect>(view.group, '.header')
    expect(header.height()).toBe(
      LAYOUT.HEADER_HEIGHT - NODE_BODY_STROKE_WIDTH * 2,
    )
    expect(header.cornerRadius()).toBe(14)
  })
})

describe('node decorations', () => {
  it('draws separators under the header and between every handle row', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a', { type: 'number' })
    addHandle(node, 'b', { type: 'number' })
    addHandle(node, 'c', { type: 'number' })

    const off = new NodeView(
      node,
      theme({ colors: { headerDivider: '', rowDivider: '' } }),
    )
    expect(find<Konva.Line>(off.group, '.headerDivider').visible()).toBe(false)
    expect(off.group.find('.rowDivider').length).toBe(0)

    const view = new NodeView(
      node,
      theme({
        colors: { headerDivider: '#111111', rowDivider: '#222222' },
        metrics: { nodeCornerRadius: 0 },
      }),
    )

    const header = find<Konva.Line>(view.group, '.headerDivider')
    expect(header.visible()).toBe(true)
    // The divider closes the band, whose bottom edge sits one body stroke
    // above the row area.
    const dividerY = LAYOUT.HEADER_HEIGHT - NODE_BODY_STROKE_WIDTH
    expect(header.points()).toEqual([
      NODE_BODY_STROKE_WIDTH,
      dividerY,
      200 - NODE_BODY_STROKE_WIDTH,
      dividerY,
    ])
    expect(header.stroke()).toBe('#111111')

    const rows = view.group.find<Konva.Line>('.rowDivider')
    expect(rows.length).toBe(2)
    const row = LAYOUT.HANDLE_ROW_HEIGHT
    expect(rows[0]!.points()).toEqual([
      0,
      LAYOUT.HEADER_HEIGHT + row,
      200,
      LAYOUT.HEADER_HEIGHT + row,
    ])
    expect(rows[1]!.points()).toEqual([
      0,
      LAYOUT.HEADER_HEIGHT + row * 2,
      200,
      LAYOUT.HEADER_HEIGHT + row * 2,
    ])
    expect(rows[0]!.stroke()).toBe('#222222')

    // A rounded body pulls the separators in so they stay inside the silhouette.
    const rounded = new NodeView(
      node,
      theme({
        colors: { headerDivider: '#111111', rowDivider: '#222222' },
        metrics: { nodeCornerRadius: 12 },
      }),
    )
    expect(rounded.group.find<Konva.Line>('.rowDivider')[0]!.points()).toEqual([
      6, 58, 194, 58,
    ])

    // Collapsing hides every separator with the rows they separate.
    node.setCollapsed(true)
    view.update()
    expect(find<Konva.Line>(view.group, '.headerDivider').visible()).toBe(false)
    expect(rows[0]!.visible()).toBe(false)
  })

  it('draws bold, untransformed titles', () => {
    const node = makeNode(1, 'hello')

    const view = new NodeView(node)
    const name = find<Konva.Text>(view.group, '.name')
    expect(name.text()).toBe('hello')
    expect(name.fontStyle()).toBe('bold')
    expect(name.letterSpacing()).toBe(0)

    node.name = 'world'
    view.update()
    expect(name.text()).toBe('world')
  })
})

describe('joint style', () => {
  it('hollows the joint and takes its shape from the theme', () => {
    const node = makeNode(1, 'A')
    addHandle(node, 'out', { position: HandlePosition.Right, type: '' })

    const view = new NodeView(
      node,
      theme({
        metrics: { jointShape: 'diamond', jointRingWidth: 2 },
        colors: { jointRing: '#ffffff' },
      }),
    )
    const joint = view._handleViews.get('out')!._joint!

    expect(joint.fill()).toBe('#ffffff')
    expect(joint.stroke()).toBe(DEFAULT_THEME.colors.jointDefault)
    expect(joint.strokeWidth()).toBe(2)

    const before = drawnCalls(joint).join(' ')
    expect(before).toContain('moveTo(')

    // The shape is swapped in place — no view rebuild.
    view.applyTheme(theme({ metrics: { jointShape: 'circle' } }))
    expect(drawnCalls(joint).join(' ')).toContain('arc(')
  })

  it('keeps the joint filled by default', () => {
    const node = makeNode(1, 'A')
    addHandle(node, 'out', { position: HandlePosition.Right, type: '' })

    const view = new NodeView(node)
    const joint = view._handleViews.get('out')!._joint!

    expect(joint.fill()).toBe(DEFAULT_THEME.colors.jointDefault)
    expect(joint.strokeWidth()).toBe(1)
  })
})

describe('node shadow', () => {
  it('carries a static style shadow and defers to the executor highlight', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a', { type: 'number' })
    const view = new NodeView(
      node,
      theme({ colors: { nodeShadow: 'transparent' } }),
    )
    const body = find<Konva.Rect>(view.group, '.body')
    const shadow = find<Konva.Rect>(view.group, '.shadow')

    // The body never casts a shadow; the rect behind it does.
    expect(body.shadowEnabled()).toBe(false)
    expect(shadow.shadowEnabled()).toBe(false)
    expect(shadow.fill()).toBe(DEFAULT_THEME.colors.bg)

    view.applyTheme(
      theme({
        colors: { nodeShadow: 'rgba(0, 0, 0, 0.2)' },
        metrics: {
          nodeShadowBlur: 6,
          nodeShadowOffsetX: 0,
          nodeShadowOffsetY: 2,
        },
      }),
    )
    expect(shadow.shadowEnabled()).toBe(true)
    expect(shadow.shadowBlur()).toBe(6)
    expect(shadow.shadowOffset()).toEqual({ x: 0, y: 2 })

    view.setExecuteHighlight(true, true)
    expect(shadow.shadowColor()).toBe(DEFAULT_THEME.colors.accentSoft)
    expect(shadow.shadowOffset()).toEqual({ x: 0, y: 0 })

    view.setExecuteHighlight(false, false)
    expect(shadow.shadowEnabled()).toBe(true)
    expect(shadow.shadowBlur()).toBe(6)
    expect(shadow.shadowColor()).toBe('rgba(0, 0, 0, 0.2)')
  })

  it('keeps a running highlight across a theme swap', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a', { type: 'number' })
    const view = new NodeView(node)
    const shadow = find<Konva.Rect>(view.group, '.shadow')

    view.setExecuteHighlight(true, true)
    view.applyTheme(theme({ colors: { nodeShadow: 'rgba(0, 0, 0, 0.4)' } }))

    expect(shadow.shadowColor()).toBe(DEFAULT_THEME.colors.accentSoft)
    expect(shadow.shadowOffset()).toEqual({ x: 0, y: 0 })
  })
})

describe('edges', () => {
  function makeContainer() {
    const c = document.createElement('div')
    Object.defineProperty(c, 'clientWidth', { value: 800 })
    Object.defineProperty(c, 'clientHeight', { value: 600 })
    return c
  }

  it('dashes edges from the theme and hot-swaps in place', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    const b = ws.addNode('Sum')
    a.moveTo(10, 10)
    b.moveTo(300, 10)
    ws.connect(a.getHandle('value')!, b.getHandle('a')!)

    const renderer = new KonvaGraphRenderer(makeContainer(), ws, {
      theme: { metrics: { edgeDash: [8, 4] } },
    })
    try {
      const line = renderer.stage.findOne<Konva.Line>('.edge-line')!
      expect(line.dash()).toEqual([8, 4])

      renderer.setTheme({ metrics: { edgeDash: [] } })
      expect(line.dash()).toEqual([])
    } finally {
      renderer.dispose()
    }
  })

  it('dashes edges and group outlines with the shipped default', () => {
    const ws = createWorkspace()
    const a = ws.addNode('Number')
    const b = ws.addNode('Sum')
    a.moveTo(10, 10)
    b.moveTo(300, 10)
    ws.connect(a.getHandle('value')!, b.getHandle('a')!)
    groupNodes(ws, a.id, b.id)

    const renderer = new KonvaGraphRenderer(makeContainer(), ws)
    try {
      const line = renderer.stage.findOne<Konva.Line>('.edge-line')!
      expect(line.dash()).toEqual(DEFAULT_THEME.metrics.edgeDash)

      const bodies = renderer.stage.find<Konva.Rect>('.body')
      expect(bodies[0]!.dash()).toEqual(DEFAULT_THEME.metrics.edgeDash)
    } finally {
      renderer.dispose()
    }
  })
})
