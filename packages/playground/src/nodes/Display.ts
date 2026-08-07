import { HandlePosition } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'

export const displayDefinition: INodeDefinition = {
  schema: {
    name: 'Display',
    handles: [
      {
        key: 'input',
        name: 'Input',
        position: HandlePosition.Left,
        accepts: '*',
        value: '',
        type: 'display',
      },
    ],
  },
}
