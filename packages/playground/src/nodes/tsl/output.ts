import { HandlePosition } from '@0x-jerry/golden-graph'
import type { Workspace } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import { TSL_NUMERIC } from './code'

export const TSL_OUTPUT_NODE_TYPE = 'TSL.Output'

export const outputDefinition: INodeDefinition = {
  schema: {
    name: 'Output',
    description:
      'Sends the wired source to the preview: the model material on the material scene, the render pipeline on the pipeline scene',
    handles: [
      {
        key: 'input',
        name: 'Source',
        position: HandlePosition.Left,
        accepts: TSL_NUMERIC,
        value: 'vec3(0.0)',
      },
    ],
  },
}

/** Source of the first top-level Output node, if it has one. */
export function readTslSource(ws: Workspace): string | null {
  for (const node of ws.nodes) {
    if (node.type !== TSL_OUTPUT_NODE_TYPE) {
      continue
    }

    const source = node.getData('input')

    if (typeof source === 'string' && source.trim()) {
      return source
    }
  }

  return null
}
