import { afterEach, describe, expect, it } from 'vitest'
import { HandlePosition, Workspace } from '@0x-jerry/golden-graph'
import type { INodeSchema, NodeHandle } from '@0x-jerry/golden-graph'
import { numberHandleFactory } from '../../src/renderer/handles/NumberHandle'
import type { NodeHandleModule } from '../../src/renderer/handles/types'
import type { Input } from '../../src/renderer/components/input'
import { TextModel } from '../../src/renderer/components/input/TextModel'
import {
  handleInputKeyDown,
  type InputKeyEnv,
} from '../../src/renderer/components/input/keyboard'

type SteppableModule = NodeHandleModule & { _input: Input }

const modules: SteppableModule[] = []

afterEach(() => {
  for (const module of modules.splice(0)) {
    module.destroy()
  }
})

/**
 * A workspace-backed handle: stepping goes through `handle.setValue`, which
 * emits on the node's workspace and would throw on a workspace-less node.
 */
function makeNumberHandle(
  opts: { value?: number; step?: number } = {},
): NodeHandle {
  const schema: INodeSchema = {
    type: 'Stepper',
    name: 'Stepper',
    handles: [
      {
        key: 'value',
        name: 'Value',
        type: 'number',
        position: HandlePosition.Left,
        value: opts.value ?? 1,
        ...(opts.step === undefined ? {} : { options: { step: opts.step } }),
      },
    ],
  }

  const ws = new Workspace()
  ws.registerNodeSchema(schema)
  return ws.addNode('Stepper').getHandle('value')!
}

function startEditing(handle: NodeHandle): SteppableModule {
  const module = numberHandleFactory.create!(
    handle,
    handle.getOptions(),
    undefined,
  ) as SteppableModule

  module._input._startEdit()
  modules.push(module)
  return module
}

function press(key: 'ArrowUp' | 'ArrowDown') {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

function keyEnv(step?: (delta: number) => void): InputKeyEnv {
  return {
    sync: () => {},
    blink: () => {},
    commit: () => {},
    cancel: () => {},
    clearHidden: () => {},
    ...(step ? { step } : {}),
  }
}

describe('number handle stepping', () => {
  it('steps by the configured amount without floating point noise', () => {
    const base = makeNumberHandle()
    const baseModule = startEditing(base)
    expect(base.getValue()).toBe(1)

    press('ArrowUp')
    expect(base.getValue()).toBe(2)
    expect(baseModule._input.getValue()).toBe('2')
    press('ArrowDown')
    expect(base.getValue()).toBe(1)
    press('ArrowDown')
    expect(base.getValue()).toBe(0)

    const stepped = makeNumberHandle({ step: 0.5 })
    startEditing(stepped)
    press('ArrowUp')
    expect(stepped.getValue()).toBe(1.5)
    press('ArrowUp')
    expect(stepped.getValue()).toBe(2)

    const frac = makeNumberHandle({ value: 0.1, step: 0.1 })
    const fracModule = startEditing(frac)
    press('ArrowUp')
    expect(frac.getValue()).toBe(0.2)
    expect(fracModule._input.getValue()).toBe('0.2')
    press('ArrowUp')
    press('ArrowUp')
    expect(frac.getValue()).toBe(0.4)
  })

  it('falls back to 1 for a non-positive or invalid step', () => {
    for (const step of [0, -2, Number.NaN]) {
      const handle = makeNumberHandle({ step })
      startEditing(handle)

      press('ArrowUp')
      expect(handle.getValue()).toBe(2)
    }
  })

  it('routes arrows to the step hook when provided, otherwise leaves them to the model', () => {
    const model = new TextModel({ value: '1', measure: () => 0 })

    const plain = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      cancelable: true,
    })
    handleInputKeyDown(model, plain, keyEnv())
    expect(model.value).toBe('1')
    expect(plain.defaultPrevented).toBe(false)

    const deltas: number[] = []
    const env = keyEnv((delta) => deltas.push(delta))
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowUp'] as const) {
      const evt = new KeyboardEvent('keydown', { key, cancelable: true })
      handleInputKeyDown(model, evt, env)
      expect(evt.defaultPrevented).toBe(true)
    }

    expect(deltas).toEqual([1, -1, 1])
    expect(model.value).toBe('1')
  })
})
