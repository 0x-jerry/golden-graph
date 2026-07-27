import { HandlePosition } from '../../../src/core'
import type { INodeDefinition } from '../../../src/backend'

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
