import { HandlePosition, Node, NodeType, type Workspace } from '../../src/core'

export function setup(workspace: Workspace) {
  workspace.registerNode('Number', NumberNode)
  workspace.registerNode('ToString', ToStringNode)
  workspace.registerNode('Output', OutputNode)

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
      options: {
        type: 'number',
      },
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
      options: {
        type: 'text',
        content: 'This is a ToString node, and some text explanation',
      },
    })

    this.addHandle({
      key: 'output',
      name: 'Output',
      position: HandlePosition.Right,
      type: 'string',
    })
  }

  onProcess = () => {
    const value = this.getData('input')
    this.setData('output', String(value))
  }
}

class OutputNode extends Node {
  constructor() {
    super()

    this.name = 'Output'

    this.addHandle({
      key: 'input',
      name: 'Input',
      position: HandlePosition.Left,
      type: '*',
      value: '',
      options: {
        type: 'display',
      },
    })
  }
}
