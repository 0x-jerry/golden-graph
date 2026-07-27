import { HandlePosition } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'

export const displayDefinition: INodeDefinition = {
  schema: {
    type: 'Output',
    name: 'Display',
    handles: [
      {
        key: 'input',
        name: 'Input',
        position: HandlePosition.Left,
        type: '*',
        value: '',
        options: {
          type: 'display',
        },
      },
    ],
  },
}
