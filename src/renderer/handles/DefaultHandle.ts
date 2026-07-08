import Konva from 'konva'
import type { NodeHandle } from '../../core'
import { COLORS } from '../types'
import type { HandleModule } from './types'

export const type = 'default'

export const create: HandleModule['create'] = (handle) => {
  const group = new Konva.Group()
  const text = new Konva.Text({
    text: handle.name,
    fontSize: 12,
    fill: COLORS.TEXT_MUTED,
    align: 'center',
    verticalAlign: 'middle',
  })
  group.add(text)
  return group
}
