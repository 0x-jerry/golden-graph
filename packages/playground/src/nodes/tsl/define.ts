import { HandlePosition } from '@0x-jerry/golden-graph'
import type { INodeHandleConfig } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import { TSL_NUMERIC, toTslCode } from './code'

export interface TslParam {
  key: string
  name?: string
  accepts?: string | string[]
  /** Source used while no edge feeds the input. */
  value?: string
  description?: string
}

export interface TslNodeConfig {
  name: string
  description: string
  params?: TslParam[]
  output?: { key?: string; name?: string; accepts?: string | string[] }
  build?: (args: Record<string, string>) => string
}

export function param(
  key: string,
  name = key,
  accepts: string | string[] = TSL_NUMERIC,
  value = '0.0',
  description?: string,
): TslParam {
  return { key, name, accepts, value, description }
}

/**
 * A node that composes exactly one TSL expression: its inputs resolve to
 * source fragments, `build` assembles them, and the result is written to the
 * output handle so downstream nodes read it as their input.
 */
export function defineTslNode(config: TslNodeConfig): INodeDefinition {
  const params = config.params ?? []
  const outputKey = config.output?.key ?? 'out'
  const build = config.build ?? (() => '')

  const defaults: Record<string, string> = {}
  for (const item of params) {
    defaults[item.key] = item.value ?? '0.0'
  }

  const handles: INodeHandleConfig[] = params.map((item) => ({
    key: item.key,
    name: item.name ?? item.key,
    position: HandlePosition.Left,
    accepts: item.accepts ?? TSL_NUMERIC,
    value: item.value ?? '0.0',
    description: item.description,
  }))

  handles.push({
    key: outputKey,
    name: config.output?.name ?? 'Out',
    position: HandlePosition.Right,
    accepts: config.output?.accepts ?? TSL_NUMERIC,
    // Built from the defaults so the output is valid source before any run.
    value: build(defaults),
  })

  return {
    schema: {
      name: config.name,
      description: config.description,
      handles,
    },
    execute: (ctx) => {
      const args: Record<string, string> = {}

      for (const item of params) {
        args[item.key] = toTslCode(ctx.getData(item.key))
      }

      ctx.setData(outputKey, build(args))
    },
  }
}
