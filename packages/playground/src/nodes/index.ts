import type { INodeProvider } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import { debugNodeProviders } from './debug'
import { tslNodeProviders } from './tsl'

export const nodeProviders: INodeProvider<INodeDefinition>[] = [
  ...tslNodeProviders,
  ...debugNodeProviders,
]
