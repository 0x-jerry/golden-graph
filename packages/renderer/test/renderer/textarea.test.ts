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
  it('inserts a newline on Enter', () => {
    const ta = makeTextarea('ab')
    press('Enter')
    expect(ta.getValue()).toBe('ab\n')
    expect(ta.active).toBe(true)
  })

  it('inserts a newline on Shift+Enter too', () => {
    const ta = makeTextarea('ab')
    press('Enter', { shiftKey: true })
    expect(ta.getValue()).toBe('ab\n')
  })

  it('commits on Escape', () => {
    const ta = makeTextarea('ab')
    ta._model.insertText('c')
    press('Escape')
    expect(ta.active).toBe(false)
    expect(ta.getValue()).toBe('abc')
  })

  it('commits on blur (deactivate)', () => {
    const ta = makeTextarea('ab')
    ta._model.insertText('c')
    ta.deactivate()
    expect(ta.getValue()).toBe('abc')
  })

  it('moves down a line with ArrowDown', () => {
    const ta = makeTextarea('a\nb')
    ta._model.setCursor(0)
    press('ArrowDown')
    expect(ta._model.cursorPos).toBe(2)
  })

  it('moves up a line with ArrowUp', () => {
    const ta = makeTextarea('a\nb')
    ta._model.setCursor(3)
    press('ArrowUp')
    expect(ta._layout!.pointAt(ta._model.cursorPos).line).toBe(0)
  })

  it('makes Home/End line-relative', () => {
    const ta = makeTextarea('aa\nbbb')
    ta._model.setCursor(5)
    press('Home')
    expect(ta._model.cursorPos).toBe(3)
    press('End')
    expect(ta._model.cursorPos).toBe(6)
  })
})

describe('Textarea scrolling', () => {
  it('grows content past the box and scrolls on wheel', () => {
    const ta = new Textarea({
      inputWidth: 60,
      inputHeight: 30,
      value: 'word '.repeat(50),
    })
    live.push(ta)
    ta._startEdit()

    const area = ta._scrollArea
    expect(area._contentHeight).toBeGreaterThan(area._h)
    area.fire('wheel', { evt: { preventDefault() {}, deltaY: 100 } }, true)
    expect(area.scrollTop).toBeGreaterThan(0)
  })

  it('keeps short content inside the box', () => {
    const ta = new Textarea({
      inputWidth: 100,
      inputHeight: 60,
      value: 'short',
    })
    live.push(ta)
    expect(ta._scrollArea._contentHeight).toBeLessThanOrEqual(60)
  })

  it('keeps the scroll position on commit', () => {
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
