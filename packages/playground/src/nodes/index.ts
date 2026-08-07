import type { INodeProvider } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import { colorDefinition } from './Color'
import { displayDefinition } from './Display'
import { imageLoaderDefinition } from './images/ImageLoader'
import { mathNodeProvider } from './math'
import { numberDefinition } from './Number'
import { textDefinition } from './Text'
import { toStringDefinition } from './ToString'

/**
 * Node providers registered on the backend. Node types are auto-generated
 * as `id ? \`${id}.${key}\` : key` — the flat `Base` provider preserves the
 * legacy unscoped types (`Number`, `Text`, `Output`, ...), while `Math`
 * yields `Math.Op`.
 */
export const nodeProviders: INodeProvider<INodeDefinition>[] = [
  {
    id: '',
    name: 'Base',
    nodes: {
      Number: numberDefinition,
      Text: textDefinition,
      ToString: toStringDefinition,
      Output: displayDefinition,
      ImageLoader: imageLoaderDefinition,
      Color: colorDefinition,
    },
  },
  mathNodeProvider,
]
