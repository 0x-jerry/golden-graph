import { describe, it, expect } from 'vitest'
import { Select } from '../../src/renderer/components/select'
import { makeStage } from '../helpers/stage'

const LONG = 'a-very-long-option-label-that-cannot-fit'

describe('select labels stay inside their box', () => {
  it('truncates the selected label with an ellipsis instead of wrapping out', () => {
    const select = new Select({
      selectWidth: 60,
      options: [LONG],
      value: LONG,
    })

    expect(select._textNode.textArr).toHaveLength(1)
    expect(select._textNode.textArr[0]!.text).toMatch(/…$/)

    select.destroy()
  })

  it('truncates long dropdown options with an ellipsis', () => {
    const { stage, layer } = makeStage()
    const select = new Select({
      selectWidth: 60,
      options: [LONG, 'b'],
    })
    layer.add(select)
    select._openDropdown()

    const text = select._dropdown!._texts[0]!
    expect(text.textArr).toHaveLength(1)
    expect(text.textArr[0]!.text).toMatch(/…$/)

    stage.destroy()
  })
})
