import { HandleComponentRegistry } from '@0x-jerry/golden-graph'
import type { NodeHandleFactory } from './types'

import { textHandleFactory } from './TextHandle'
import { numberHandleFactory } from './NumberHandle'
import { selectHandleFactory } from './SelectHandle'
import { displayHandleFactory } from './DisplayHandle'
import { imageHandleFactory } from './ImageHandle'
import { colorHandleFactory } from './ColorHandle'

const factories: NodeHandleFactory[] = [
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

/**
 * Register (or restyle) a handle factory by `type`. Registering an existing
 * type merges its `config` (e.g. a new `joint` style) while preserving the
 * registered widget and other config — so a joint-only restyle keeps the
 * existing widget/layout. This is the way to set a joint style per type.
 */
export function registerHandleFactory(factory: NodeHandleFactory) {
  const existing = registry.get(factory.type)
  if (existing) {
    const merged: NodeHandleFactory = {
      ...existing,
      ...factory,
      config: { ...existing.config, ...factory.config },
    }
    registry.register(factory.type, merged)
    return
  }
  registry.register(factory.type, factory)
  factories.push(factory)
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
