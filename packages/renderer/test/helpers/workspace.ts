import { Group, HandlePosition, Workspace } from '@0x-jerry/golden-graph'
import type { INodeSchema, IVec2 } from '@0x-jerry/golden-graph'

export const numberSchema: INodeSchema = {
  type: 'Number',
  name: 'Number',
  handles: [
    {
      key: 'value',
      name: 'Value',
      accepts: 'number',
      position: HandlePosition.Right,
      value: 1,
    },
  ],
}

export const sumSchema: INodeSchema = {
  type: 'Sum',
  name: 'Sum',
  handles: [
    { key: 'a', name: 'A', accepts: 'number', position: HandlePosition.Left },
    { key: 'b', name: 'B', accepts: 'number', position: HandlePosition.Left },
    {
      key: 'out',
      name: 'Out',
      accepts: 'number',
      position: HandlePosition.Right,
    },
  ],
}

export function createWorkspace() {
  const ws = new Workspace()
  ws.registerNodeSchema(numberSchema)
  ws.registerNodeSchema(sumSchema)
  return ws
}

export function groupNodes(ws: Workspace, ...ids: number[]) {
  const group = new Group()
  group.id = ws.nextId()
  group.setWorkspace(ws)
  group.nodes.push(...ids)
  ws._groups.push(group)
  return group
}

export function makeGroup(
  ws: Workspace,
  opts: { pos?: IVec2; size?: IVec2; nodes?: number[] } = {},
) {
  const group = new Group()
  group.id = ws.nextId()
  group.setWorkspace(ws)
  if (opts.pos) group.setPos(opts.pos)
  if (opts.size) group.setSize(opts.size)
  if (opts.nodes) group.nodes.push(...opts.nodes)
  ws._groups.push(group)
  return group
}

/** Parent graph with an internal subgraph: 3 external edges, 3 internal. */
export function createSubGraphWorkspace() {
  const ws = createWorkspace()
  const extIn = ws.addNode('Number')
  const extOut = ws.addNode('Sum')
  const n1 = ws.addNode('Number')
  const sum = ws.addNode('Sum')

  ws.connect(extIn.getHandle('value')!, sum.getHandle('a')!)
  ws.connect(n1.getHandle('value')!, sum.getHandle('b')!)
  ws.connect(sum.getHandle('out')!, extOut.getHandle('a')!)

  const group = groupNodes(ws, n1.id, sum.id)
  ws.convertGroupToSubGraph(group.id)

  return ws
}
