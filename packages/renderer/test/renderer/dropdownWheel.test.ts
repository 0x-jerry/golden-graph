import { describe, it, expect } from 'vitest'
import { Select } from '../../src/renderer/components/select'
import { makeStage } from '../helpers/stage'

describe('dropdown wheel does not reach the stage', () => {
  it('scrolls the list without triggering the canvas zoom handler', () => {
    const { stage, layer } = makeStage()
    const select = new Select({
      selectWidth: 120,
      options: Array.from({ length: 10 }, (_, i) => `opt-${i}`),
      maxVisibleItems: 4,
    })
    layer.add(select)
    select._openDropdown()

    let zoomed = false
    stage.on('wheel', () => {
      zoomed = true
    })

    select._dropdown!.fire(
      'wheel',
      { evt: { preventDefault() {}, deltaY: 100 } },
      true,
    )

    expect(zoomed).toBe(false)
    expect(select._dropdown!.scrollTop).toBe(1)

    stage.destroy()
  })
})
