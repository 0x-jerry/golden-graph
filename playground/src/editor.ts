import { NodeType, type Workspace } from '../../src'
import { registerNodes } from './nodes'

export function setup(workspace: Workspace) {
  registerNodes(workspace)

  const n1 = workspace.addNode('Number', {
    nodeType: NodeType.Entry,
    pos: {
      x: 100,
      y: 100,
    },
  })

  const n2 = workspace.addNode('ToString', {
    pos: {
      x: 200,
      y: 200,
    },
  })

  workspace.addNode('Output', {
    pos: {
      x: 500,
      y: 500,
    },
  })

  workspace.connect(n1.getHandle('output')!, n2.getHandle('input')!)

  return workspace
}
