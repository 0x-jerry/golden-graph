import type { GHandle } from '../../core'
import type { RHandle } from './Handle'
import { RNumberHandle } from './NumberHandle'

interface Ctor<T> {
  new (data?: any): T
}

const factories = new Map<string, Ctor<RHandle>>()

factories.set('number', RNumberHandle)

export function createHandle(data: GHandle) {
  const Ctor = factories.get(data.type)

  if (!Ctor) {
    throw new Error(`Can not find Ctor for ${data.type}`)
  }
  return new Ctor(data)
}
