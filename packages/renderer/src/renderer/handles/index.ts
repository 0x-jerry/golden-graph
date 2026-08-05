import { HandleComponentRegistry } from '@0x-jerry/golden-graph'
import type { HandleModule } from './types'

import { textHandle } from './TextHandle'
import { numberHandle } from './NumberHandle'
import { selectHandle } from './SelectHandle'
import { displayHandle } from './DisplayHandle'
import { imageHandle } from './ImageHandle'

const registry = new HandleComponentRegistry<HandleModule>()
  .register(textHandle.type, textHandle)
  .register(numberHandle.type, numberHandle)
  .register(selectHandle.type, selectHandle)
  .register(displayHandle.type, displayHandle)
  .register(imageHandle.type, imageHandle)

export const getHandleModule = (type: string) => registry.get(type)

/**
 * Remove shared DOM editors (appended to `document.body`) created by handle
 * modules. Should be called when the renderer is disposed.
 */
export function disposeHandleEditors() {
  imageHandle.dispose?.()
}