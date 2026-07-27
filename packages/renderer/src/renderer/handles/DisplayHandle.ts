import Konva from 'konva'
import { COLORS, LAYOUT } from '../constants'
import type { HandleModule } from './types'

export const type = 'display'

const DISPLAY_WIDTH = LAYOUT.NODE_WIDTH - LAYOUT.HANDLE_PADDING * 2

export const create: HandleModule['create'] = (handle) => {
  const group = new Konva.Group()
  const text = new Konva.Text({
    name: 'value',
    text: String(handle.getValue() ?? ''),
    fontSize: 12,
    fill: COLORS.TEXT_MUTED,
    width: DISPLAY_WIDTH,
    wrap: 'word',
  })
  group.add(text)
  return group
}

export const update: HandleModule['update'] = (group, handle) => {
  const text = group.findOne<Konva.Text>('.value')
  if (text) {
    text.text(String(handle.getValue() ?? ''))
  }
}
