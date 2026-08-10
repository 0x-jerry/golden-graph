import { HandlePosition, NodeType } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'

export const numberDefinition: INodeDefinition = {
  schema: {
    name: 'Number Input',
    description: 'Emits a constant number value',
    nodeType: NodeType.Entry,
    handles: [
      {
        key: 'output',
        name: 'Number',
        position: HandlePosition.Right,
        accepts: 'number',
        value: 10,
        type: 'number',
      },
    ],
  },
}
