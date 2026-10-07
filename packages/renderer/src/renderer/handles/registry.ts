import { HandleComponentRegistry } from '@0x-jerry/golden-graph'
import type { NodeHandleFactory } from './types'

/**
 * Factory registry, kept in its own module so `layout`/`placement` can look
 * up a handle's factory without importing `handles/index` — which imports the
 * factories that in turn import `layout` (a cycle that would otherwise leave
 * a factory `undefined` during module init).
 */
export const registry = new HandleComponentRegistry<NodeHandleFactory>()

export const getHandleFactory = (type: string) => registry.get(type)
