import Konva from 'konva'
import type { NodeHandle } from '../../core'
import { COLORS } from '../types'
import type { HandleModule } from './types'

export const type = 'number'

function formatText(handle: NodeHandle) {
  return `${handle.name}: ${handle.getValue() ?? ''}`
}

export const create: HandleModule['create'] = (handle) => {
  const group = new Konva.Group()
  const text = new Konva.Text({
    text: formatText(handle),
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
    text.text(formatText(handle))
  }
}
