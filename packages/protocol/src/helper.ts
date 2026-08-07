import type { INodeHandleLoc } from './types'

export function edgeLocKey(loc: INodeHandleLoc) {
  return `${loc.id}:${loc.key}`
}
