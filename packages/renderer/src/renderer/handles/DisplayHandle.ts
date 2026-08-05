import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { COLORS, LAYOUT, getNodeWidth } from '../constants'
import type { HandleModule } from './types'

export const displayHandle: HandleModule = {
  type: 'display',
  config: { layout: 'block' },

  create: (handle) => {
    const group = new Konva.Group()
    const text = new Konva.Text({
      name: 'value',
      text: String(handle.getValue() ?? ''),
      fontSize: 12,
      fill: COLORS.TEXT_MUTED,
      width: displayWidth(handle),
      wrap: 'word',
    })
    group.add(text)
    return group
  },

  update: (group, handle) => {
    const text = group.findOne<Konva.Text>('.value')
    if (text) {
      text.text(String(handle.getValue() ?? ''))
      text.width(displayWidth(handle))
    }
  },
}

function displayWidth(handle: NodeHandle): number {
  return getNodeWidth(handle.node) - LAYOUT.HANDLE_PADDING * 2
}
