import { HandlePosition } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import { toTslCode } from './code'
import { defineTslNode, param } from './define'

/** Inigo Quilez cosine palette coefficients, as raw rgb triples. */
const PALETTE_KEYS = ['a', 'b', 'c', 'd'] as const

const PALETTE_DEFAULTS = {
  t: '0.0',
  a: '#808080',
  b: '#808080',
  c: '#ffffff',
  d: '#0055aa',
}

const TAU = '6.283185307179586'

const PALETTE_DESCRIPTIONS: Record<(typeof PALETTE_KEYS)[number], string> = {
  a: 'Bias of the cosine ramp',
  b: 'Amplitude of the cosine ramp',
  c: 'Frequency of the cosine ramp',
  d: 'Phase of the cosine ramp',
}

function build(terms: Record<string, string>): string {
  const wave = `cos(mul(${TAU}, add(mul(${terms.c}, ${terms.t}), ${terms.d})))`
  return `add(${terms.a}, mul(${terms.b}, ${wave}))`
}

/**
 * `a + b·cos(2π(c·t + d))` — one float coordinate becomes a full color ramp.
 * The coefficients are raw vectors, so the color widgets are not sRGB-decoded.
 */
export const paletteDefinition: INodeDefinition = {
  schema: {
    name: 'Cosine Palette',
    description: 'a + b·cos(2π(c·t + d)) — Inigo Quilez palette',
    handles: [
      {
        key: 't',
        name: 'T',
        position: HandlePosition.Left,
        accepts: 'float',
        value: PALETTE_DEFAULTS.t,
        description: 'Palette coordinate — noise, radius, gradient, ...',
      },
      ...PALETTE_KEYS.map((key) => ({
        key,
        name: key.toUpperCase(),
        position: HandlePosition.Left,
        accepts: 'vec3',
        type: 'color',
        value: PALETTE_DEFAULTS[key],
        description: PALETTE_DESCRIPTIONS[key],
      })),
      {
        key: 'out',
        name: 'Color',
        position: HandlePosition.Right,
        accepts: 'vec3',
        value: build(PALETTE_DEFAULTS),
      },
    ],
  },
  execute: (ctx) => {
    const terms: Record<string, string> = {
      t: toTslCode(ctx.getData('t')),
    }

    for (const key of PALETTE_KEYS) {
      terms[key] = toTslCode(ctx.getData(key), true)
    }

    ctx.setData('out', build(terms))
  },
}

export const mix = defineTslNode({
  name: 'Mix',
  description: 'mix(a, b, t) — blends two colors',
  params: [
    param('a', 'A', ['vec3', 'vec4'], 'vec3(0, 0, 0)'),
    param('b', 'B', ['vec3', 'vec4'], 'vec3(1, 1, 1)'),
    param('t', 'T', 'float', '0.5', 'Blend factor: 0 keeps A, 1 keeps B'),
  ],
  output: { name: 'Color', accepts: ['vec3', 'vec4'] },
  build: ({ a, b, t }) => `mix(${a}, ${b}, ${t})`,
})

export const smoothstep = defineTslNode({
  name: 'Smoothstep',
  description: 'smoothstep(e0, e1, x) — smooth ramp between two edges',
  params: [
    param('e0', 'Edge0', 'float', '0.0', 'Input value mapped to 0'),
    param('e1', 'Edge1', 'float', '1.0', 'Input value mapped to 1'),
    param('x', 'X'),
  ],
  build: ({ e0, e1, x }) => `smoothstep(${e0}, ${e1}, ${x})`,
})

export const step = defineTslNode({
  name: 'Step',
  description: 'step(edge, x) — 0 below the edge, 1 above it',
  params: [param('edge', 'Edge', 'float', '0.5'), param('x', 'X')],
  build: ({ edge, x }) => `step(${edge}, ${x})`,
})

export const saturate = defineTslNode({
  name: 'Saturate',
  description: 'saturate(x) — clamps to the 0..1 range',
  params: [param('x', 'X')],
  build: ({ x }) => `saturate(${x})`,
})
