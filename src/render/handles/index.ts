import type { GHandle } from '../../core'
import type { RHandle } from './Handle'
import { RInputHandle } from './InputHandle'
import { RTextHandle } from './TextHandle'

interface Ctor<T> {
  new (data?: any): T
}

const factories = new Map<string, Ctor<RHandle>>()

factories.set('number', RInputHandle)
factories.set('text', RTextHandle)

export function createHandle(data: GHandle) {
  const Ctor = factories.get(data.type)

  if (!Ctor) {
    throw new Error(`Can not find Ctor for ${data.type}`)
  }
  return new Ctor(data)
}
