import { HandlePosition } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import { TSL_NUMERIC, toTslCode } from './code'
import { defineTslNode, param } from './define'

const SWIZZLE_COMPONENTS = ['x', 'y', 'z', 'w', 'xy', 'xyz', 'rgb']

export const swizzle: INodeDefinition = {
  schema: {
    name: 'Swizzle',
    description: 'Reads components of a value, e.g. uv().y',
    handles: [
      {
        key: 'in',
        name: 'In',
        position: HandlePosition.Left,
        accepts: TSL_NUMERIC,
        value: 'uv()',
      },
      {
        key: 'component',
        name: 'As',
        value: 'x',
        type: 'select',
        description: 'Components to read from the value',
        options: { options: SWIZZLE_COMPONENTS },
      },
      {
        key: 'out',
        name: 'Out',
        position: HandlePosition.Right,
        accepts: TSL_NUMERIC,
        value: 'uv().x',
      },
    ],
  },
  execute: (ctx) => {
    const value = toTslCode(ctx.getData('in'))
    ctx.setData('out', `${value}.${readComponent(ctx.getData('component'))}`)
  },
}

function readComponent(value: unknown): string {
  return typeof value === 'string' && SWIZZLE_COMPONENTS.includes(value)
    ? value
    : 'x'
}

export const length = defineTslNode({
  name: 'Length',
  description: 'length(v) — vector magnitude',
  params: [param('v', 'V')],
  output: { name: 'Len', accepts: 'float' },
  build: ({ v }) => `length(${v})`,
})

export const dot = defineTslNode({
  name: 'Dot',
  description: 'dot(a, b) — dot product',
  params: [param('a', 'A'), param('b', 'B')],
  output: { name: 'Dot', accepts: 'float' },
  build: ({ a, b }) => `dot(${a}, ${b})`,
})

export const normalize = defineTslNode({
  name: 'Normalize',
  description: 'normalize(v) — unit vector',
  params: [param('v', 'V')],
  build: ({ v }) => `normalize(${v})`,
})

export const cross = defineTslNode({
  name: 'Cross',
  description: 'cross(a, b) — cross product',
  params: [param('a', 'A', 'vec3'), param('b', 'B', 'vec3')],
  output: { accepts: 'vec3' },
  build: ({ a, b }) => `cross(${a}, ${b})`,
})
