import { afterEach, describe, it, expect } from 'vitest'
import { Textarea } from '../../src/renderer/components/text'

const live: Textarea[] = []

afterEach(() => {
  for (const ta of live.splice(0)) ta.destroy()
})

function makeTextarea(value = '') {
  const ta = new Textarea({ inputWidth: 100, inputHeight: 50, value })
  live.push(ta)
  ta._startEdit()
  return ta
}

function press(key: string, opts: KeyboardEventInit = {}) {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key, cancelable: true, ...opts }),
  )
}

describe('Textarea editing', () => {
  it('inserts a newline on Enter and Shift+Enter', () => {
    const a = makeTextarea('ab')
    press('Enter')
    expect(a.getValue()).toBe('ab\n')
    expect(a.active).toBe(true)

    const b = makeTextarea('ab')
    press('Enter', { shiftKey: true })
    expect(b.getValue()).toBe('ab\n')
  })

  it('commits the edited value on Escape and on blur', () => {
    const esc = makeTextarea('ab')
    esc._model.insertText('c')
    press('Escape')
    expect(esc.active).toBe(false)
    expect(esc.getValue()).toBe('abc')

    const blur = makeTextarea('ab')
    blur._model.insertText('c')
    blur.deactivate()
    expect(blur.getValue()).toBe('abc')
  })

  it('navigates lines with ArrowUp/Down and Home/End', () => {
    const down = makeTextarea('a\nb')
    down._model.setCursor(0)
    press('ArrowDown')
    expect(down._model.cursorPos).toBe(2)

    const up = makeTextarea('a\nb')
    up._model.setCursor(3)
    press('ArrowUp')
    expect(up._layout!.pointAt(up._model.cursorPos).line).toBe(0)

    const homeEnd = makeTextarea('aa\nbbb')
    homeEnd._model.setCursor(5)
    press('Home')
    expect(homeEnd._model.cursorPos).toBe(3)
    press('End')
    expect(homeEnd._model.cursorPos).toBe(6)
  })
})

describe('Textarea scrolling', () => {
  it('scrolls content taller than the box and keeps short content inside', () => {
    const tall = new Textarea({
      inputWidth: 60,
      inputHeight: 30,
      value: 'word '.repeat(50),
    })
    live.push(tall)
    tall._startEdit()

    const area = tall._scrollArea
    expect(area._contentHeight).toBeGreaterThan(area._h)
    area.fire('wheel', { evt: { preventDefault() {}, deltaY: 100 } }, true)
    expect(area.scrollTop).toBeGreaterThan(0)

    const short = new Textarea({
      inputWidth: 100,
      inputHeight: 60,
      value: 'short',
    })
    live.push(short)
    expect(short._scrollArea._contentHeight).toBeLessThanOrEqual(60)
  })

  it('keeps scroll position on commit and ends the caret drag on window mouseup', () => {
    const ta = new Textarea({
      inputWidth: 60,
      inputHeight: 30,
      value: 'word '.repeat(50),
    })
    live.push(ta)
    ta._startEdit()
    ta._scrollArea.scrollTo(30)
    expect(ta._scrollArea.scrollTop).toBe(30)
    press('Escape')
    expect(ta._scrollArea.scrollTop).toBe(30)

    const drag = makeTextarea('a\nb')
    drag._scrollArea.fire('mousedown', { evt: {} }, true)
    expect(drag._dragging).toBe(true)

    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(drag._dragging).toBe(false)
  })
})

describe('Textarea committed value', () => {
  it('fires onChange once on commit and not again on destroy', () => {
    const changes: string[] = []
    const ta = new Textarea({
      inputWidth: 100,
      inputHeight: 50,
      value: 'ab',
      onChange: (v) => changes.push(v),
    })
    live.push(ta)
    ta._startEdit()
    ta._model.insertText('c')
    ta.deactivate()
    expect(changes).toEqual(['abc'])
    ta.destroy()
    live.splice(live.indexOf(ta), 1)
    expect(changes).toEqual(['abc'])
  })
})
