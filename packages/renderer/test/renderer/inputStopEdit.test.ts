import { describe, it, expect } from 'vitest'
import { Input } from '../../src/renderer/components/input'
import { makeStage } from '../helpers/stage'

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

describe('Input caret drag teardown', () => {
  it('detaches the stage drag listeners on session end and destroy', () => {
    const { stage, layer } = makeStage()
    const input = new Input({ inputWidth: 120, value: 'Foo' })
    layer.add(input)
    stage.draw()

    const listeners = (type: string) =>
      stage.eventListeners[type]?.length ?? 0
    const press = () => {
      stage.setPointersPositions(
        new MouseEvent('pointermove', { clientX: 10, clientY: 10 }),
      )
      input._bg.fire('mousedown')
    }

    press()
    expect(input._dragging).toBe(true)
    expect(listeners('mousemove')).toBe(1)
    expect(listeners('mouseup')).toBe(1)

    // A session that ends with the pointer still down must release them.
    input.deactivate()
    expect(input._dragging).toBe(false)
    expect(listeners('mousemove')).toBe(0)
    expect(listeners('mouseup')).toBe(0)

    // So must destroying the input mid-drag.
    press()
    expect(listeners('mousemove')).toBe(1)
    input.destroy()
    expect(listeners('mousemove')).toBe(0)
    expect(listeners('mouseup')).toBe(0)
  })
})
