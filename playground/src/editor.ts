import { HandlePosition, Node, type Workspace } from '../../src/core'

export function setup(workspace: Workspace) {
  workspace.registerNode('Number', NumberNode)
  workspace.registerNode('ToString', ToStringNode)

  const n1 = workspace.addNode('Number', {
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

  workspace.addNode('ToString', {
    pos: {
      x: 300,
      y: 300,
    },
  })

  workspace.connect(n1.getHandle('output')!, n2.getHandle('input')!)

  return workspace
}

class NumberNode extends Node {
  constructor() {
    super()

    this.name = 'Number Input'

    this.addHandle({
      key: 'output',
      name: 'Number',
      position: HandlePosition.Right,
      type: 'number',
      value: 10,
    })
  }
}

class ToStringNode extends Node {
  constructor() {
    super()

    this.name = 'To String'

    this.addHandle({
      key: 'input',
      name: 'Input',
      type: '*',
      position: HandlePosition.Left,
    })

    this.addHandle({
      key: 'output',
      name: 'Output',
      position: HandlePosition.Right,
      type: 'string',
    })
  }
}
