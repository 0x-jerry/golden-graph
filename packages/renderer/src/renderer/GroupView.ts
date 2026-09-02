import Konva from 'konva'
import type { Group } from '@0x-jerry/golden-graph'
import type { Input } from './components/input'
import {
  LAYOUT,
  NODE_SHAPE,
  RESIZE_HANDLE_SIZE,
  ELEMENT_TYPE,
  ATTR,
} from './constants'
import { EntityView } from './EntityView'
import { EditableText } from './components/EditableText'
import { ResizeHandle } from './components/ResizeHandle'
import { DEFAULT_THEME } from '../theme'
import type { GraphTheme } from '../theme'

const NAME_X = 8
const NAME_Y = 16
const NAME_INPUT_HEIGHT = 18

export class GroupView extends EntityView<Group> {
  _body: Konva.Rect
  _header: Konva.Rect
  _name: EditableText
  _resize: ResizeHandle
  /** Active theme, re-applied on hot-swap via `applyTheme`. */
  _theme: GraphTheme
  /** Latest active-selection state, re-applied on theme change. */
  _isActive = false

  constructor(group: Group, theme: GraphTheme = DEFAULT_THEME) {
    const g = new Konva.Group({
      x: group.pos.x,
      y: group.pos.y,
      name: ELEMENT_TYPE.GROUP,
      [ATTR.ELEMENT_ID]: group.id,
    })

    const body = new Konva.Rect({
      width: group.size.x,
      height: group.size.y,
      fill: theme.colors.groupBg,
      stroke: theme.colors.groupBorder,
      strokeWidth: 1,
      cornerRadius: theme.metrics.groupCornerRadius,
      name: NODE_SHAPE.BODY,
    })
    g.add(body)

    const header = new Konva.Rect({
      width: group.size.x,
      height: LAYOUT.GROUP_HEADER_HEIGHT,
      fill: theme.colors.groupHeaderBg,
      name: NODE_SHAPE.HEADER,
    })
    g.add(header)

    const nameText = new EditableText({
      x: NAME_X,
      y: NAME_Y,
      text: group.name,
      fontFamily: theme.fonts.family,
      fill: theme.colors.textPrimary,
      name: NODE_SHAPE.NAME,
      inputWidth: () => Math.max(120, group.size.x - 16),
      inputHeight: NAME_INPUT_HEIGHT,
      inputFill: theme.colors.groupHeaderBg,
      onChange: (value) => {
        group.setName(value.trim() || 'Untitled')
      },
    }, theme)
    g.add(nameText)

    super(group, g)
    this._theme = theme
    this._body = body
    this._header = header
    this._name = nameText

    header.on('dblclick', () => this.startRename())

    const resize = new ResizeHandle(theme)
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
    this._name.setText(group.name)

    this._resize.x(group.size.x - RESIZE_HANDLE_SIZE)
    this._resize.y(group.size.y - RESIZE_HANDLE_SIZE)
  }

  /** Reflect active group selection state: body border + resize grip. */
  setActive(isActive: boolean): void {
    this._isActive = isActive
    this._body.stroke(
      isActive ? this._theme.colors.accent : this._theme.colors.groupBorder,
    )
    this._resize.visible(isActive)
  }

  applyTheme(theme: GraphTheme): void {
    this._theme = theme
    this._body.fill(theme.colors.groupBg)
    this._body.stroke(theme.colors.groupBorder)
    this._body.cornerRadius(theme.metrics.groupCornerRadius)
    this._header.fill(theme.colors.groupHeaderBg)
    // Keep the inline title editor's background in sync with the group
    // header for future edit sessions.
    this._name.setInputFill(theme.colors.groupHeaderBg)
    this._name.applyTheme?.(theme)
    this._resize.applyTheme?.(theme)
    this.setActive(this._isActive)
  }

  /** Open the inline title editor over the group header. */
  startRename() {
    this._name.startEdit()
  }

  /** Inline group-title editor currently open, if any. */
  get _nameInput(): Input | null {
    return this._name._input
  }

  destroy(): void {
    this._name.destroy()
    super.destroy()
  }
}
