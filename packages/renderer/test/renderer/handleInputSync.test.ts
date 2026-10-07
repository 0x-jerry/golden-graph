import { describe, it, expect } from 'vitest'
import { Input } from '../../src/renderer/components/input'
import { Select } from '../../src/renderer/components/select'

describe('handle editors do not write back unchanged values', () => {
  it('writes back only on change in Input/Select and matches numeric options', () => {
    let inputChanges = 0
    const input = new Input({
      inputWidth: 120,
      value: 'Foo',
      onChange: () => inputChanges++,
    })
    // Syncing the same value back (e.g. an unrelated node update) must not
    // cascade a `handle.setValue` event.
    input.setValue('Foo')
    expect(inputChanges).toBe(0)
    input.setValue('Bar')
    expect(inputChanges).toBe(1)
    input.destroy()

    let selectChanges = 0
    const select = new Select({
      selectWidth: 120,
      options: ['a', 'b'],
      value: 'a',
      onChange: () => selectChanges++,
    })
    select.setValue('a')
    expect(selectChanges).toBe(0)
    select.setValue('b')
    expect(selectChanges).toBe(1)
    select.destroy()

    // A numeric option list has to match the current value, otherwise the box
    // renders its placeholder and the items render empty labels.
    const picked: string[] = []
    const numeric = new Select({
      selectWidth: 120,
      options: [1, 2, 3],
      value: '2',
      onChange: (value) => picked.push(value),
    })
    expect(numeric._textNode.text()).toBe('2')
    numeric._selectIndex(2)
    expect(picked).toEqual(['3'])
    numeric.destroy()
  })
})
