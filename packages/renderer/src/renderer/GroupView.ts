import Konva from 'konva'
import type { Group } from '@0x-jerry/golden-graph'
import {
  COLORS,
  LAYOUT,
  NODE_SHAPE,
  ELEMENT_TYPE,
  ATTR,
} from './constants'
import { EntityView } from './EntityView'

export class GroupView extends EntityView<Group> {
  _body: Konva.Rect
  _header: Konva.Rect
  _name: Konva.Text

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
      x: 8,
      y: 16,
      name: NODE_SHAPE.NAME,
    })
    g.add(nameText)

    super(group, g)
    this._body = body
    this._header = header
    this._name = nameText
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
  }

  /** Reflect active group selection state: body border color. */
  setActive(isActive: boolean): void {
    this._body.stroke(isActive ? COLORS.ACCENT : COLORS.GROUP_BORDER)
  }
}