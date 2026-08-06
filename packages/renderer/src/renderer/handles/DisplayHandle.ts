import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { COLORS, LAYOUT, getNodeWidth } from '../constants'
import type { NodeHandleFactory, NodeHandleModule } from './types'

class DisplayModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle

  constructor(handle: NodeHandle) {
    super()
    this._handle = handle

    const text = new Konva.Text({
      name: 'value',
      text: String(handle.getValue() ?? ''),
      fontSize: 12,
      fill: COLORS.TEXT_MUTED,
      width: displayWidth(handle),
      wrap: 'word',
    })
    this.add(text)
  }

  update(): void {
    const text = this.findOne<Konva.Text>('.value')
    if (text) {
      text.text(String(this._handle.getValue() ?? ''))
      text.width(displayWidth(this._handle))
    }
  }
}

export const displayHandleFactory: NodeHandleFactory = {
  type: 'display',
  config: { layout: 'block' },
  create: (handle) => new DisplayModule(handle),
}

function displayWidth(handle: NodeHandle): number {
  return getNodeWidth(handle.node) - LAYOUT.HANDLE_PADDING * 2
}
