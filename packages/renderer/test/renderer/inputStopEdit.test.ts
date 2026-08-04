import { describe, it, expect } from 'vitest'
import { Input } from '../../src/renderer/components/input'

describe('Input onStopEdit', () => {
  it('fires once when an edit session ends and not again on destroy', () => {
    let stopped = 0
    const input = new Input({
      inputWidth: 120,
      value: 'Foo',
      onStopEdit: () => stopped++,
    })

    input._startEdit()
    input.deactivate()

    expect(stopped).toBe(1)

    input.destroy()
    expect(stopped).toBe(1)
  })

  it('does not fire without an active edit session', () => {
    let stopped = 0
    const input = new Input({
      inputWidth: 120,
      value: 'Foo',
      onStopEdit: () => stopped++,
    })

    input.destroy()
    expect(stopped).toBe(0)
  })
})
