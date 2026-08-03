import { HandleComponentRegistry } from '@0x-jerry/golden-graph'
import type { HandleModule } from './types'

import { TextHandle } from './TextHandle'
import { NumberHandle } from './NumberHandle'
import { SelectHandle } from './SelectHandle'
import { DisplayHandle } from './DisplayHandle'
import { ImageHandle } from './ImageHandle'

const textHandle = new TextHandle()
const numberHandle = new NumberHandle()
const selectHandle = new SelectHandle()
const displayHandle = new DisplayHandle()
const imageHandle = new ImageHandle()

const registry = new HandleComponentRegistry<HandleModule>()
  .register(TextHandle.type, textHandle)
  .register(NumberHandle.type, numberHandle)
  .register(SelectHandle.type, selectHandle)
  .register(DisplayHandle.type, displayHandle)
  .register(ImageHandle.type, imageHandle)

export const getHandleModule = (type: string) => registry.get(type)

/**
 * Remove shared DOM editors (appended to `document.body`) created by handle
 * modules. Should be called when the renderer is disposed.
 */
export function disposeHandleEditors() {
  imageHandle.dispose()
}