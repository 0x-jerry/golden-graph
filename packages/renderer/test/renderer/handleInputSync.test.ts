import { describe, it, expect } from 'vitest'
import { Input } from '../../src/renderer/components/input'
import { Select } from '../../src/renderer/components/select'

describe('handle editors do not write back unchanged values', () => {
  it('Input.setValue fires onChange only when the value changes', () => {
    let changes = 0
    const input = new Input({
      inputWidth: 120,
      value: 'Foo',
      onChange: () => changes++,
    })

    // Syncing the same value back (e.g. an unrelated node update) must not
    // cascade a `handle.setValue` event.
    input.setValue('Foo')
    expect(changes).toBe(0)

    input.setValue('Bar')
    expect(changes).toBe(1)

    input.destroy()
  })

  it('Select.setValue fires onChange only when the value changes', () => {
    let changes = 0
    const select = new Select({
      selectWidth: 120,
      options: ['a', 'b'],
      value: 'a',
      onChange: () => changes++,
    })

    select.setValue('a')
    expect(changes).toBe(0)

    select.setValue('b')
    expect(changes).toBe(1)

    select.destroy()
  })
})
