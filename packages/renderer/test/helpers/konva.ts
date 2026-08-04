import type Konva from 'konva'

export function find<T extends Konva.Node>(group: Konva.Group, sel: string): T {
  return group.findOne<T>(sel) as T
}
