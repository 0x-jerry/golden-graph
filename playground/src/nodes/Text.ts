import { HandlePosition, NodeType } from '../../../src/core'
import type { INodeDefinition } from '../../../src/backend'

export const textDefinition: INodeDefinition = {
  schema: {
    type: 'Text',
    name: 'Text Input',
    nodeType: NodeType.Entry,
    handles: [
      {
        key: 'output',
        name: 'Text',
        position: HandlePosition.Right,
        type: 'string',
        value: 'hello',
        options: {
          type: 'text',
        },
      },
    ],
  },
}
