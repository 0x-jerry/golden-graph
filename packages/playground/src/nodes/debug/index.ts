import type { INodeProvider } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import {
  displayDemoDefinition,
  selectDemoDefinition,
  textareaDemoDefinition,
} from './demo'

export const debugNodeProviders: INodeProvider<INodeDefinition>[] = [
  {
    id: 'DEBUG',
    name: 'DEBUG',
    nodes: {
      Select: selectDemoDefinition,
      Textarea: textareaDemoDefinition,
      Display: displayDemoDefinition,
    },
  },
]
