import { describe, it, expect } from 'vitest'
import { Select } from '../../src/renderer/components/select'
import { makeStage } from '../helpers/stage'

const LONG = 'a-very-long-option-label-that-cannot-fit'

describe('select labels stay inside their box', () => {
  it('truncates the selected label and long dropdown options with an ellipsis', () => {
    const select = new Select({
      selectWidth: 60,
      options: [LONG],
      value: LONG,
    })

    expect(select._textNode.textArr).toHaveLength(1)
    expect(select._textNode.textArr[0]!.text).toMatch(/…$/)
    select.destroy()

    const { stage, layer } = makeStage()
    const opened = new Select({
      selectWidth: 60,
      options: [LONG, 'b'],
    })
    layer.add(opened)
    opened._openDropdown()

    const text = opened._dropdown!._texts[0]!
    expect(text.textArr).toHaveLength(1)
    expect(text.textArr[0]!.text).toMatch(/…$/)

    stage.destroy()
  })
})
