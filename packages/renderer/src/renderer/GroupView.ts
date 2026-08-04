import Konva from 'konva'
import type { Group } from '@0x-jerry/golden-graph'
import { Input } from './components/input'
import {
  COLORS,
  LAYOUT,
  NODE_SHAPE,
  RESIZE_HANDLE_SIZE,
  ELEMENT_TYPE,
  ATTR,
} from './constants'
import { EntityView } from './EntityView'
import { ResizeHandle } from './components/ResizeHandle'
import { PADDING } from './components/shared'

const NAME_X = 8
const NAME_Y = 16

export class GroupView extends EntityView<Group> {
  _body: Konva.Rect
  _header: Konva.Rect
  _name: Konva.Text
  _resize: ResizeHandle

  /** Inline group-title editor currently open, if any. */
  _nameInput: Input | null = null

  constructor(group: Group) {
    const g = new Konva.Group({
      x: group.pos.x,
      y: group.pos.y,
      name: ELEMENT_TYPE.GROUP,
      [ATTR.ELEMENT_ID]: group.id,
    })

    const body = new Konva.Rect({
      width: group.size.x,
      height: group.size.y,
      fill: COLORS.GROUP_BG,
      stroke: COLORS.GROUP_BORDER,
      strokeWidth: 1,
      name: NODE_SHAPE.BODY,
    })
    g.add(body)

    const header = new Konva.Rect({
      width: group.size.x,
      height: LAYOUT.GROUP_HEADER_HEIGHT,
      fill: COLORS.GROUP_HEADER_BG,
      name: NODE_SHAPE.HEADER,
    })
    g.add(header)

    const nameText = new Konva.Text({
      text: group.name,
      fontSize: 13,
      fill: COLORS.TEXT_PRIMARY,
      x: NAME_X,
      y: NAME_Y,
      name: NODE_SHAPE.NAME,
    })
    g.add(nameText)

    super(group, g)
    this._body = body
    this._header = header
    this._name = nameText

    header.on('dblclick', () => this.startRename())
    nameText.on('dblclick', () => this.startRename())

    const resize = new ResizeHandle()
    resize.x(group.size.x - RESIZE_HANDLE_SIZE)
    resize.y(group.size.y - RESIZE_HANDLE_SIZE)
    g.add(resize)
    this._resize = resize
  }

  update(): void {
    const group = this.entity
    const g = this.group

    g.x(group.pos.x)
    g.y(group.pos.y)

    this._body.width(group.size.x)
    this._body.height(group.size.y)
    this._header.width(group.size.x)
    this._name.text(group.name)

    this._resize.x(group.size.x - RESIZE_HANDLE_SIZE)
    this._resize.y(group.size.y - RESIZE_HANDLE_SIZE)
  }

  /** Reflect active group selection state: body border + resize grip. */
  setActive(isActive: boolean): void {
    this._body.stroke(isActive ? COLORS.ACCENT : COLORS.GROUP_BORDER)
    this._resize.visible(isActive)
  }

  /** Open the inline title editor over the group header. */
  startRename() {
    if (this._nameInput) return

    const group = this.entity
    const fontSize = 13
    const inputHeight = 18
    const input = new Input({
      // Offset so the input's own text (inset by PADDING, vertically centered)
      // lands exactly where the static title is drawn.
      x: NAME_X - PADDING,
      y: NAME_Y - (inputHeight - fontSize) / 2,
      inputWidth: Math.max(120, group.size.x - 16),
      inputHeight,
      value: group.name,
      fontSize,
      fill: COLORS.GROUP_HEADER_BG,
      onChange: (value) => {
        group.setName(value.trim() || 'Untitled')
      },
      onStopEdit: () => this._stopRename(),
    })

    this._nameInput = input
    this._name.visible(false)
    this.group.add(input)
    this.group.getLayer()?.batchDraw()
    input._startEdit()
  }

  _stopRename() {
    if (!this._nameInput) return
    const input = this._nameInput
    this._nameInput = null
    this._name.visible(true)
    input.destroy()
    this.group.getLayer()?.batchDraw()
  }

  destroy(): void {
    this._stopRename()
    super.destroy()
  }
}
