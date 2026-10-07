import { HandlePosition } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import { toTslCode } from './code'

const OCTAVES = [1, 2, 3, 4, 5]
const DEFAULT_OCTAVES = 4
const DEFAULT_POSITION = 'sub(mul(uv(), 2.0), 1.0)'
const DEFAULT_Z = 'time'

function build(p: string, z: string, octaves: number): string {
  return `mx_fractal_noise_float(vec3(${p}, ${z}), ${octaves}, 2.0, 0.5)`
}

/**
 * MaterialX fractal noise: `p` is a vec2 plus a third axis `z` that defaults
 * to `time`, so a fresh node already flows.
 */
export const noiseDefinition: INodeDefinition = {
  schema: {
    name: 'Fractal Noise',
    description: 'mx_fractal_noise_float(vec3(p, z), octaves, 2, 0.5)',
    handles: [
      {
        key: 'p',
        name: 'P',
        position: HandlePosition.Left,
        accepts: 'vec2',
        value: DEFAULT_POSITION,
        description: 'Sample position — wire a centered UV',
      },
      {
        key: 'z',
        name: 'Z',
        position: HandlePosition.Left,
        accepts: 'float',
        value: DEFAULT_Z,
        description: 'Third axis; follows time unless wired',
      },
      {
        key: 'octaves',
        name: 'Octaves',
        value: DEFAULT_OCTAVES,
        type: 'select',
        description: 'Fractal detail',
        options: { options: OCTAVES },
      },
      {
        key: 'out',
        name: 'Noise',
        position: HandlePosition.Right,
        accepts: 'float',
        value: build(DEFAULT_POSITION, DEFAULT_Z, DEFAULT_OCTAVES),
      },
    ],
  },
  execute: (ctx) => {
    const p = toTslCode(ctx.getData('p'))
    const z = toTslCode(ctx.getData('z'))

    ctx.setData('out', build(p, z, readOctaves(ctx.getData('octaves'))))
  },
}

function readOctaves(value: unknown): number {
  const octaves = Number(value)
  return OCTAVES.includes(octaves) ? octaves : DEFAULT_OCTAVES
}
