import { describe, it, expect } from 'vitest'
import { Input } from '../../src/renderer/components/input'

describe('Input onStopEdit', () => {
  it('fires once when an edit session ends, never without one or on destroy', () => {
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

    let idle = 0
    const noEdit = new Input({
      inputWidth: 120,
      value: 'Foo',
      onStopEdit: () => idle++,
    })

    noEdit.destroy()
    expect(idle).toBe(0)
  })
})
