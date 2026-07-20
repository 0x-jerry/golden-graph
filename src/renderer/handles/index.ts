import { HandleComponentRegistry } from '../../core'
import type { HandleModule } from './types'

import * as TextHandle from './TextHandle'
import * as NumberHandle from './NumberHandle'
import * as SelectHandle from './SelectHandle'
import * as DisplayHandle from './DisplayHandle'
import * as ImageHandle from './ImageHandle'
import * as DefaultHandle from './DefaultHandle'

const registry = new HandleComponentRegistry<HandleModule>()
  .register(TextHandle.type, TextHandle)
  .register(NumberHandle.type, NumberHandle)
  .register(SelectHandle.type, SelectHandle)
  .register(DisplayHandle.type, DisplayHandle)
  .register(ImageHandle.type, ImageHandle)
  .setDefault(DefaultHandle)

export const getHandleModule = (type: string) => registry.get(type)

/**
 * Remove shared DOM editors (appended to `document.body`) created by handle
 * modules. Should be called when the renderer is disposed.
 */
export function disposeHandleEditors() {
  TextHandle.dispose()
  NumberHandle.dispose()
  SelectHandle.dispose()
  ImageHandle.dispose()
}
