import Konva from 'konva'
import type { NodeHandle } from '../../core'
import type { INodeHandleConfigOptions } from '../../core'
import type { HandleModule } from './types'
import { COLORS } from '../types'

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
