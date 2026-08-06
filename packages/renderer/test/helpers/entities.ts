import type { NodeHandle } from '@0x-jerry/golden-graph'
import { Edge, Node } from '@0x-jerry/golden-graph'
import { HandlePosition } from '@0x-jerry/golden-graph'
import type {
  INodeHandleConfig,
  INodeHandleConfigOptions,
} from '@0x-jerry/golden-graph'

export function makeNode(
  id: number,
  name: string,
  opts: { x?: number; y?: number } = {},
): Node {
  const node = new Node()
  node.id = id
  node.name = name
  node.moveTo(opts.x ?? 0, opts.y ?? 0)
  return node
}

export function addHandle(
  node: Node,
  key: string,
  opts: {
    position?: HandlePosition
    type?: string
    name?: string
    options?: INodeHandleConfigOptions
  } = {},
): NodeHandle {
  const config: INodeHandleConfig = {
    key,
    position: opts.position ?? HandlePosition.Left,
    type: opts.type ?? 'display',
    name: opts.name ?? '',
  }
  if (opts.options) {
    config.options = opts.options
  }
  node.addHandle(config)
  return node.getHandle(key)!
}

export function makeEdge(
  start: { node: Node; key: string },
  end: { node: Node; key: string },
): Edge | null {
  const s = start.node.getHandle(start.key)
  const e = end.node.getHandle(end.key)
  if (!s || !e) return null
  const edge = new Edge()
  edge.id = start.node.id * 100 + end.node.id
  // Set endpoints directly (instead of `setEndpoints`, which emits on the
  // workspace's event emitter) — geometry only reads the handles.
  ;(edge as Edge & { _start?: NodeHandle })._start = s
  ;(edge as Edge & { _end?: NodeHandle })._end = e
  return edge
}
