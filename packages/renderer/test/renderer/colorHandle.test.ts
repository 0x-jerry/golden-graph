import { describe, expect, it } from 'vitest'
import Konva from 'konva'
import { HandlePosition, Workspace } from '@0x-jerry/golden-graph'
import { makeNode, addHandle } from '../helpers/entities'
import { find } from '../helpers/konva'
import { NodeView } from '../../src/renderer/NodeView'
import { COLORS } from '../../src/renderer/constants'
import {
  COLOR_FIELD_HEIGHT,
  ColorPicker,
  PRESET_COLORS,
  hsvToHex,
  hexToHsv,
} from '../../src/renderer/components/color'
import { ActiveElementManager } from '../../src/renderer/ActiveElementManager'
import type { NodeHandle } from '@0x-jerry/golden-graph'

function makeStage() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const stage = new Konva.Stage({
    container,
    width: 1000,
    height: 800,
  })
  const layer = new Konva.Layer()
  stage.add(layer)
  return { stage, layer, container }
}

function makeColorNode(color?: string): { node: ReturnType<typeof makeNode>; handle: NodeHandle } {
  const node = makeNode(1, 'Color')
  const handle = addHandle(node, 'color', {
    position: HandlePosition.Right,
    type: 'color',
    name: 'Color',
  })
  if (color) {
    handle.setInitialValue(color)
  }
  // `handle.setValue` emits on the node's workspace.
  new Workspace().addRawNode(node)
  return { node, handle }
}

function modulePicker(view: NodeView): ColorPicker {
  const module = find<Konva.Group>(view.group, '.content')
  return (module as unknown as { _picker: ColorPicker })._picker
}

describe('ColorHandle', () => {
  it('renders a circle swatch filled with the current value', () => {
    const { node } = makeColorNode('#ff0000')
    const view = new NodeView(node)

    const swatch = find<Konva.Group>(view.group, '.content').findOne<Konva.Circle>('.swatch')
    expect(swatch).toBeTruthy()
    expect(swatch?.fill()).toBe('#ff0000')
  })

  it('defaults to white when the handle has no value', () => {
    const { node } = makeColorNode()
    const view = new NodeView(node)

    const swatch = find<Konva.Group>(view.group, '.content').findOne<Konva.Circle>('.swatch')
    expect(swatch?.fill()).toBe('#ffffff')
  })

  it('opens the panel on click and applies a preset color without closing', () => {
    const { node, handle } = makeColorNode('#000000')
    const view = new NodeView(node)
    const { stage, layer, container } = makeStage()
    layer.add(view.group)
    stage.draw()

    const picker = modulePicker(view)
    picker._swatch.fire('click')
    expect(picker._panel).toBeTruthy()

    const swatch = picker._panel!.findOne<Konva.Rect>('.swatch')!
    const color = swatch.fill() as string
    swatch.fire('click')

    expect(picker._panel).not.toBeNull()
    expect(picker.getValue()).toBe(color)
    expect(handle.getValue()).toBe(color)

    stage.destroy()
    container.remove()
  })

  it('syncs the custom picker when a preset is clicked', () => {
    const picker = new ColorPicker({ pickerWidth: 180, value: '#ffffff' })
    const { stage, layer, container } = makeStage()
    layer.add(picker)
    stage.draw()

    picker._swatch.fire('click')
    const panel = picker._panel!
    const custom = panel._custom

    panel.findOne<Konva.Rect>('.swatch')!.fire('click')

    const { h, s, v } = hexToHsv(PRESET_COLORS[0]!)
    expect(custom._hue).toBeCloseTo(h)
    expect(custom._sat).toBeCloseTo(s)
    expect(custom._val).toBeCloseTo(v)
    expect(custom._svBase.fill()).toBe(hsvToHex(h, 1, 1))

    stage.destroy()
    container.remove()
  })

  it('picks a custom color from the SV field without closing', () => {
    const picker = new ColorPicker({ pickerWidth: 180, value: '#ff0000' })
    const { stage, layer, container } = makeStage()
    layer.add(picker)
    stage.draw()

    picker._swatch.fire('click')
    const panel = picker._panel!
    expect(panel).toBeTruthy()

    // Top-left of the SV field → saturation 0, value 1 → white.
    panel._custom._pickSV(0, 0)
    expect(picker.getValue()).toBe('#ffffff')
    // Panel stays open for continued custom picking.
    expect(picker._panel).not.toBeNull()

    stage.destroy()
    container.remove()
  })

  it('picks a hue from the hue bar', () => {
    const picker = new ColorPicker({ pickerWidth: 180, value: '#ff0000' })
    const { stage, layer, container } = makeStage()
    layer.add(picker)
    stage.draw()

    picker._swatch.fire('click')
    const panel = picker._panel!

    // Middle of the hue bar → hue 180 → cyan (sat 1, val 1 preserved).
    panel._custom._pickHue(COLOR_FIELD_HEIGHT / 2)
    expect(picker.getValue()).toBe('#00ffff')
    expect(picker._panel).not.toBeNull()

    stage.destroy()
    container.remove()
  })

  it('converts between HSV and hex', () => {
    expect(hsvToHex(0, 1, 1)).toBe('#ff0000')
    expect(hsvToHex(120, 1, 1)).toBe('#00ff00')
    expect(hsvToHex(180, 1, 1)).toBe('#00ffff')
    expect(hsvToHex(0, 0, 1)).toBe('#ffffff')
    expect(hexToHsv('#00ffff')).toEqual({ h: 180, s: 1, v: 1 })
    expect(hexToHsv('abc')).toEqual({
      h: 210.00000000000003,
      s: 0.16666666666666677,
      v: 0.8,
    })
    expect(hexToHsv('not-a-color')).toEqual({ h: 0, s: 0, v: 1 })
  })

  it('closes the panel on Escape and resets the active state', () => {
    const picker = new ColorPicker({ pickerWidth: 180 })
    const { stage, layer, container } = makeStage()
    layer.add(picker)
    stage.draw()

    picker._swatch.fire('click')
    expect(picker._panel).toBeTruthy()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(picker._panel).toBeNull()
    expect((picker as unknown as { _active: boolean })._active).toBe(false)

    stage.destroy()
    container.remove()
  })

  it('dismisses the panel only when clicking outside it', () => {
    const { stage, layer, container } = makeStage()
    const manager = new ActiveElementManager(stage)
    stage.setAttr(ActiveElementManager.key, manager)
    manager.init()

    const picker = new ColorPicker({ pickerWidth: 180, value: '#ff0000' })
    layer.add(picker)
    stage.draw()

    picker._swatch.fire('click')
    expect(picker._panel).toBeTruthy()

    // A click inside the panel (on a preset swatch) keeps it open.
    picker._panel!.findOne<Konva.Rect>('.swatch')!.fire('click')
    expect(picker._panel).not.toBeNull()

    // A click on the empty stage (outside the panel) dismisses it.
    stage.fire('click')
    expect(picker._panel).toBeNull()

    manager.dispose()
    stage.destroy()
    container.remove()
  })

  it('renders a rect swatch when shape is rect', () => {
    const picker = new ColorPicker({
      pickerWidth: 180,
      shape: 'rect',
      value: '#00ff00',
    })

    expect(picker._swatch).toBeInstanceOf(Konva.Rect)
    expect((picker._swatch as Konva.Rect).fill()).toBe('#00ff00')
  })

  it('refreshes the swatch when the value changes externally', () => {
    const { node, handle } = makeColorNode('#ff0000')
    const view = new NodeView(node)

    handle.setValue('#00ff00')
    view.update()

    const swatch = find<Konva.Group>(view.group, '.content').findOne<Konva.Circle>('.swatch')
    expect(swatch?.fill()).toBe('#00ff00')
  })

  it('does not write back a non-hex value while syncing', () => {
    const { node, handle } = makeColorNode('#ff0000')
    handle.setValue('red')
    const view = new NodeView(node)
    view.update()

    // The value is only normalized for display, never clobbered on the handle.
    expect(handle.getValue()).toBe('red')
  })

  it('ends the drag when the pointer is released outside the stage', () => {
    const picker = new ColorPicker({ pickerWidth: 180, value: '#ff0000' })
    const { stage, layer, container } = makeStage()
    layer.add(picker)
    stage.draw()

    picker._swatch.fire('click')
    const custom = picker._panel!._custom

    custom._svField.fire('pointerdown', { evt: {} })
    expect(custom._dragging).toBe('sv')

    // A move with no button held ends the drag instead of changing the color.
    stage.fire('pointermove', { evt: { buttons: 0 } })
    expect(custom._dragging).toBeNull()

    stage.destroy()
    container.remove()
  })

  it('highlights the active preset while the panel stays open', () => {
    const picker = new ColorPicker({ pickerWidth: 180, value: '#ffffff' })
    const { stage, layer, container } = makeStage()
    layer.add(picker)
    stage.draw()

    picker._swatch.fire('click')
    const panel = picker._panel!
    const swatch = panel.findOne<Konva.Rect>('.swatch')!

    swatch.fire('click')

    expect(swatch.stroke()).toBe(COLORS.ACCENT)
    expect(picker._panel).not.toBeNull()

    stage.destroy()
    container.remove()
  })
})
