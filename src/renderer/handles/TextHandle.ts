import Konva from 'konva'
import type { HandleModule } from './types'
import { COLORS } from '../constants'

export const type = 'text'

export const create: HandleModule['create'] = (_handle, options) => {
  const group = new Konva.Group()
  const text = new Konva.Text({
    text: options.content ?? '',
    fontSize: 12,
    fill: COLORS.TEXT_MUTED,
    align: 'center',
    verticalAlign: 'middle',
  })
  group.add(text)
  return group
}
