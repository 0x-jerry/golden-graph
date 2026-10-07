import { HandlePosition } from '@0x-jerry/golden-graph'
import type { Workspace } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import { TSL_NUMERIC } from './code'

export const TSL_OUTPUT_NODE_TYPE = 'TSL.Output'

export const outputDefinition: INodeDefinition = {
  schema: {
    name: 'Output',
    description: 'Assigns the wired source to the material colorNode',
    handles: [
      {
        key: 'input',
        name: 'Color',
        position: HandlePosition.Left,
        accepts: TSL_NUMERIC,
        value: 'vec3(0.0)',
      },
    ],
  },
}

/** TSL source wired into the top-level Output node, if one exists. */
export function readTslSource(ws: Workspace): string | null {
  const node = ws.nodes.find((item) => item.type === TSL_OUTPUT_NODE_TYPE)
  if (!node) {
    return null
  }

  const source = node.getData('input')
  return typeof source === 'string' ? source : null
}
