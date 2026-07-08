import Konva from 'konva'
import { COLORS } from '../constants'
import type { HandleModule } from './types'

export const type = 'display'

export const create: HandleModule['create'] = (handle) => {
  const group = new Konva.Group()
  const text = new Konva.Text({
    text: JSON.stringify(handle.getValue(), null, 2),
    fontSize: 12,
    fill: COLORS.TEXT_MUTED,
    align: 'center',
    verticalAlign: 'middle',
  })
  group.add(text)
  return group
}

export const update: HandleModule['update'] = (group, handle) => {
  const text = group.findOne('Text') as Konva.Text
  if (text) {
    text.text(JSON.stringify(handle.getValue(), null, 2))
  }
}
