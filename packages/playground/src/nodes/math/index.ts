import type { INodeProvider } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import { mathOpDefinition } from './Op'

export const mathNodeProvider: INodeProvider<INodeDefinition> = {
  id: 'Math',
  name: 'Math',
  nodes: {
    Op: mathOpDefinition,
  },
}
