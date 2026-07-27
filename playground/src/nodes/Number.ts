import { HandlePosition, NodeType } from '../../../src/core'
import type { INodeDefinition } from '../../../src/backend'

export const numberDefinition: INodeDefinition = {
  schema: {
    type: 'Number',
    name: 'Number Input',
    nodeType: NodeType.Entry,
    handles: [
      {
        key: 'output',
        name: 'Number',
        position: HandlePosition.Right,
        type: 'number',
        value: 10,
        options: {
          type: 'number',
        },
      },
    ],
  },
}
