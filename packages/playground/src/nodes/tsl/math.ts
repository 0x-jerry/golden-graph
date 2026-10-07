import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import { defineTslNode, param } from './define'

function binary(
  name: string,
  description: string,
  tsName: string,
): INodeDefinition {
  return defineTslNode({
    name,
    description,
    params: [param('a', 'A'), param('b', 'B')],
    build: ({ a, b }) => `${tsName}(${a}, ${b})`,
  })
}

function unary(
  name: string,
  description: string,
  tsName: string,
): INodeDefinition {
  return defineTslNode({
    name,
    description,
    params: [param('x', 'X')],
    build: ({ x }) => `${tsName}(${x})`,
  })
}

export const add = binary('Add', 'add(a, b) — component-wise sum', 'add')
export const subtract = binary('Subtract', 'sub(a, b) — difference', 'sub')
export const multiply = binary('Multiply', 'mul(a, b) — product', 'mul')
export const divide = binary('Divide', 'div(a, b) — division', 'div')
export const power = binary('Power', 'pow(a, b) — a to the power b', 'pow')
export const minimum = binary('Minimum', 'min(a, b) — smaller value', 'min')
export const maximum = binary('Maximum', 'max(a, b) — larger value', 'max')

export const sine = unary('Sine', 'sin(x) — sine wave', 'sin')
export const cosine = unary('Cosine', 'cos(x) — cosine wave', 'cos')
export const fract = unary('Fract', 'fract(x) — fractional part', 'fract')
export const absolute = unary('Absolute', 'abs(x) — absolute value', 'abs')
export const squareRoot = unary('Square Root', 'sqrt(x) — square root', 'sqrt')
