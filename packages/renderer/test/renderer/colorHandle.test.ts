import { describe, expect, it } from 'vitest'
import Konva from 'konva'
import { HandlePosition, Workspace } from '@0x-jerry/golden-graph'
import { makeNode, addHandle } from '../helpers/entities'
import { find } from '../helpers/konva'
import { NodeView } from '../../src/renderer/NodeView'
import { DEFAULT_THEME } from '../../src/theme'
import {
  COLOR_FIELD_HEIGHT,
  ColorPicker,
  PRESET_COLORS,
  hsvToHex,
  hexToHsv,
} from '../../src/renderer/components/color'
import { ActiveElementManager } from '../../src/renderer/ActiveElementManager'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { makeStage } from '../helpers/stage'

function makeColorNode(color?: string): {
  node: ReturnType<typeof makeNode>
  handle: NodeHandle
} {
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
  it('renders a circle swatch filled with the current value, white by default', () => {
    const { node } = makeColorNode('#ff0000')
    const view = new NodeView(node)
    const swatch = find<Konva.Group>(view.group, '.content').findOne<
      Konva.Circle
    >('.swatch')
    expect(swatch).toBeTruthy()
    expect(swatch?.fill()).toBe('#ff0000')

    const { node: plain } = makeColorNode()
    const plainSwatch = find<Konva.Group>(
      new NodeView(plain).group,
      '.content',
    ).findOne<Konva.Circle>('.swatch')
    expect(plainSwatch?.fill()).toBe('#ffffff')
  })

  it('commits a preset only on dismissal, and never clobbers on a no-pick dismissal', () => {
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

    // Picking previews the color but does not touch the handle yet.
    expect(picker._panel).not.toBeNull()
    expect(picker.getValue()).toBe(color)
    expect(handle.getValue()).toBe('#000000')

    // Dismissing the picker commits the picked value to the handle.
    picker.deactivate()
    expect(handle.getValue()).toBe(color)

    stage.destroy()
    container.remove()

    // A non-hex value is normalized for display only; dismissing without a
    // pick must not clobber the handle value.
    const { node: n2, handle: h2 } = makeColorNode('red')
    const view2 = new NodeView(n2)
    const stage2 = makeStage()
    stage2.layer.add(view2.group)
    stage2.stage.draw()

    const picker2 = modulePicker(view2)
    picker2._swatch.fire('click')
    expect(picker2._panel).toBeTruthy()
    picker2.deactivate()
    expect(h2.getValue()).toBe('red')

    stage2.stage.destroy()
    stage2.container.remove()
  })

  it('syncs the custom picker from presets and picks SV/hue without closing', () => {
    const preset = new ColorPicker({ pickerWidth: 180, value: '#ffffff' })
    const { stage, layer, container } = makeStage()
    layer.add(preset)
    stage.draw()

    preset._swatch.fire('click')
    const panel = preset._panel!
    const custom = panel._custom
    panel.findOne<Konva.Rect>('.swatch')!.fire('click')

    const { h, s, v } = hexToHsv(PRESET_COLORS[0]!)
    expect(custom._hue).toBeCloseTo(h)
    expect(custom._sat).toBeCloseTo(s)
    expect(custom._val).toBeCloseTo(v)
    expect(custom._svBase.fill()).toBe(hsvToHex(h, 1, 1))

    stage.destroy()
    container.remove()

    // Top-left of the SV field → saturation 0, value 1 → white.
    const sv = new ColorPicker({ pickerWidth: 180, value: '#ff0000' })
    const svStage = makeStage()
    svStage.layer.add(sv)
    svStage.stage.draw()
    sv._swatch.fire('click')
    sv._panel!._custom._pickSV(0, 0)
    expect(sv.getValue()).toBe('#ffffff')
    expect(sv._panel).not.toBeNull()
    svStage.stage.destroy()
    svStage.container.remove()

    // Middle of the hue bar → hue 180 → cyan (sat 1, val 1 preserved).
    const hue = new ColorPicker({ pickerWidth: 180, value: '#ff0000' })
    const hueStage = makeStage()
    hueStage.layer.add(hue)
    hueStage.stage.draw()
    hue._swatch.fire('click')
    hue._panel!._custom._pickHue(COLOR_FIELD_HEIGHT / 2)
    expect(hue.getValue()).toBe('#00ffff')
    expect(hue._panel).not.toBeNull()
    hueStage.stage.destroy()
    hueStage.container.remove()
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

  it('closes on Escape, on outside click, and when a drag releases outside the stage', () => {
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

    // Escape also closes and resets the active state.
    const esc = new ColorPicker({ pickerWidth: 180 })
    const escStage = makeStage()
    escStage.layer.add(esc)
    escStage.stage.draw()
    esc._swatch.fire('click')
    expect(esc._panel).toBeTruthy()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(esc._panel).toBeNull()
    expect((esc as unknown as { _active: boolean })._active).toBe(false)

    // A pointer move with no button held ends the drag instead of recoloring.
    const drag = new ColorPicker({ pickerWidth: 180, value: '#ff0000' })
    escStage.layer.add(drag)
    escStage.stage.draw()
    drag._swatch.fire('click')
    const custom = drag._panel!._custom
    custom._svField.fire('pointerdown', { evt: {} })
    expect(custom._dragging).toBe('sv')
    escStage.stage.fire('pointermove', { evt: { buttons: 0 } })
    expect(custom._dragging).toBeNull()

    escStage.stage.destroy()
    escStage.container.remove()
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

  it('refreshes the swatch on external change and keeps non-hex values', () => {
    const { node, handle } = makeColorNode('#ff0000')
    const view = new NodeView(node)

    handle.setValue('#00ff00')
    view.update()

    const swatch = find<Konva.Group>(view.group, '.content').findOne<
      Konva.Circle
    >('.swatch')
    expect(swatch?.fill()).toBe('#00ff00')

    handle.setValue('red')
    view.update()
    // The value is only normalized for display, never clobbered on the handle.
    expect(handle.getValue()).toBe('red')
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

    expect(swatch.stroke()).toBe(DEFAULT_THEME.colors.accent)
    expect(picker._panel).not.toBeNull()

    stage.destroy()
    container.remove()
  })
})
