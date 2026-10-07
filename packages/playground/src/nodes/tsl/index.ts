import type { INodeProvider } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import * as color from './color'
import {
  colorDefinition,
  floatDefinition,
  normalDefinition,
  positionDefinition,
  timeDefinition,
  uvCenteredDefinition,
  uvDefinition,
} from './inputs'
import * as math from './math'
import { outputDefinition } from './output'
import { noiseDefinition } from './procedural'
import * as vector from './vector'

export { TSL_OUTPUT_NODE_TYPE, readTslSource } from './output'

export const tslNodeProviders: INodeProvider<INodeDefinition>[] = [
  {
    id: 'TSL.Input',
    name: 'TSL / Input',
    nodes: {
      Time: timeDefinition,
      Uv: uvDefinition,
      UvCentered: uvCenteredDefinition,
      Position: positionDefinition,
      Normal: normalDefinition,
      Float: floatDefinition,
      Color: colorDefinition,
    },
  },
  {
    id: 'TSL.Procedural',
    name: 'TSL / Procedural',
    nodes: {
      Noise: noiseDefinition,
    },
  },
  {
    id: 'TSL.Math',
    name: 'TSL / Math',
    nodes: {
      Add: math.add,
      Subtract: math.subtract,
      Multiply: math.multiply,
      Divide: math.divide,
      Power: math.power,
      Minimum: math.minimum,
      Maximum: math.maximum,
      Sine: math.sine,
      Cosine: math.cosine,
      Fract: math.fract,
      Absolute: math.absolute,
      SquareRoot: math.squareRoot,
    },
  },
  {
    id: 'TSL.Color',
    name: 'TSL / Color',
    nodes: {
      Palette: color.paletteDefinition,
      Mix: color.mix,
      Smoothstep: color.smoothstep,
      Step: color.step,
      Saturate: color.saturate,
    },
  },
  {
    id: 'TSL.Vector',
    name: 'TSL / Vector',
    nodes: {
      Swizzle: vector.swizzle,
      Length: vector.length,
      Dot: vector.dot,
      Normalize: vector.normalize,
      Cross: vector.cross,
    },
  },
  {
    id: 'TSL',
    name: 'TSL / Output',
    nodes: {
      Output: outputDefinition,
    },
  },
]
