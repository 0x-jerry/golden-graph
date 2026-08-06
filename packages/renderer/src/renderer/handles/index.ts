import { HandleComponentRegistry } from '@0x-jerry/golden-graph'
import type { NodeHandleFactory } from './types'

import { textHandleFactory } from './TextHandle'
import { numberHandleFactory } from './NumberHandle'
import { selectHandleFactory } from './SelectHandle'
import { displayHandleFactory } from './DisplayHandle'
import { imageHandleFactory } from './ImageHandle'
import { colorHandleFactory } from './ColorHandle'

const factories = [
  textHandleFactory,
  numberHandleFactory,
  selectHandleFactory,
  displayHandleFactory,
  imageHandleFactory,
  colorHandleFactory,
]

const registry = new HandleComponentRegistry<NodeHandleFactory>()

for (const factory of factories) {
  registry.register(factory.type, factory)
}

export const getHandleFactory = (type: string) => registry.get(type)

/**
 * Remove shared DOM editors (appended to `document.body`) created by handle
 * factories. Should be called when the renderer is disposed.
 */
export function disposeHandleEditors() {
  for (const factory of factories) {
    factory.dispose?.()
  }
}
