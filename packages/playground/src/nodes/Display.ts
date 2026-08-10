import { HandlePosition } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'

export const displayDefinition: INodeDefinition = {
  schema: {
    name: 'Display',
    description: 'Shows the input value as a live output',
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
