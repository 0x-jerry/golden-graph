import * as TSL from 'three/tsl'

const tslLibrary = TSL as unknown as Record<string, unknown>

/** Characters the generated source may contain before it is evaluated. */
const SAFE_SOURCE = /^[A-Za-z0-9_$.\s()+\-*/,]*$/

/** Bare identifiers only — swizzle members (`uv().x`) and exponents are skipped. */
const IDENTIFIER = /(?<![.\w$])([A-Za-z_$][\w$]*)/g

/**
 * Turn generated TSL source into a real TSL node. The source comes from the
 * node definitions in `nodes/tsl`, never from user input, and only identifiers
 * that exist in three's TSL namespace are put in scope.
 */
export function compileTslExpression(source: string): unknown {
  const trimmed = source.trim()

  if (!trimmed) {
    throw new Error('The graph produced no TSL source')
  }

  if (!SAFE_SOURCE.test(trimmed)) {
    throw new Error(`Unsupported characters in TSL source: ${trimmed}`)
  }

  const names = [
    ...new Set([...trimmed.matchAll(IDENTIFIER)].map((match) => match[1]!)),
  ]
  const unknown = names.filter((name) => !(name in tslLibrary))

  if (unknown.length) {
    throw new Error(`Unknown TSL identifier(s): ${unknown.join(', ')}`)
  }

  const factory = new Function(
    `return ({ ${names.join(', ')} }) => (${trimmed})`,
  ) as () => (library: Record<string, unknown>) => unknown

  return factory()(tslLibrary)
}
