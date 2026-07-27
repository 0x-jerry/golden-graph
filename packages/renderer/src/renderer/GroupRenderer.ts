import Konva from 'konva'
import type { Group } from '@0x-jerry/golden-graph'
import {
  COLORS,
  LAYOUT,
  NODE_SHAPE,
  SEL,
  ELEMENT_TYPE,
  ATTR,
} from './constants'

export function createGroup(group: Group): Konva.Group {
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

  return g
}

export function updateGroup(konvaGroup: Konva.Group, group: Group): void {
  konvaGroup.x(group.pos.x)
  konvaGroup.y(group.pos.y)

  const body = konvaGroup.findOne(SEL.BODY) as Konva.Rect
  if (body) {
    body.width(group.size.x)
    body.height(group.size.y)
  }

  const header = konvaGroup.findOne(SEL.HEADER) as Konva.Rect
  if (header) {
    header.width(group.size.x)
  }

  const nameText = konvaGroup.findOne(SEL.NAME) as Konva.Text
  if (nameText) {
    nameText.text(group.name)
  }
}

export function destroyGroup(konvaGroup: Konva.Group): void {
  konvaGroup.destroy()
}
