import { afterEach, describe, expect, it } from 'vitest'
import Konva from 'konva'
import { makeStage } from '../helpers/stage'
import {
  DEFAULT_DRAG_SPEED,
  SCRUB_CURSOR,
  SCRUB_DRAG_THRESHOLD,
  Scrub,
  normalizeSpeed,
} from '../../src/renderer/components/scrub'
import { applyStageCursor } from '../../src/renderer/cursor'

interface Mounted {
  stage: Konva.Stage
  target: Konva.Rect
  scrub: Scrub
  events: string[]
  deltas: number[]
}

const mounted: Mounted[] = []

afterEach(() => {
  for (const m of mounted.splice(0)) {
    m.scrub.destroy()
    m.stage.destroy()
    m.stage.container().remove()
  }
})

/** Mount a listening rect on a stage and drive it through a `Scrub`. */
function mountScrub(cfg: { speed?: number } = {}): Mounted {
  const { stage, layer } = makeStage()
  const target = new Konva.Rect({
    x: 10,
    y: 10,
    width: 100,
    height: 20,
    fill: 'rgba(0, 0, 0, 0.01)',
  })
  layer.add(target)
  stage.draw()

  const events: string[] = []
  const deltas: number[] = []
  const scrub = new Scrub({
    target,
    speed: cfg.speed,
    onStart: () => events.push('start'),
    onScrub: (delta) => deltas.push(delta),
    onEnd: () => events.push('end'),
    onEdit: () => events.push('edit'),
  })

  const m = { stage, target, scrub, events, deltas }
  mounted.push(m)
  return m
}

function press(target: Konva.Node, x = 20) {
  target.fire('mousedown', {
    cancelBubble: false,
    evt: new MouseEvent('mousedown', { clientX: x, clientY: 20 }),
  })
}

function move(x: number, init: MouseEventInit = {}) {
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, ...init }))
}

function release() {
  window.dispatchEvent(new MouseEvent('mouseup'))
}

function dblclick(target: Konva.Node) {
  target.fire('dblclick', {
    cancelBubble: false,
    evt: new MouseEvent('dblclick', { clientX: 20, clientY: 20 }),
  })
}

describe('Scrub', () => {
  it('emits the pointer travel, not the absolute position', () => {
    const { target, scrub, events, deltas } = mountScrub()
    expect(scrub.pressed).toBe(false)

    press(target, 500)
    expect(scrub.pressed).toBe(true)
    expect(events).toEqual(['start'])

    // The delta is travel divided by the speed (8 px per step by default).
    move(503)
    move(505)
    expect(deltas).toEqual([3 / DEFAULT_DRAG_SPEED, 2 / DEFAULT_DRAG_SPEED])

    release()
    expect(events).toEqual(['start', 'end'])
    expect(scrub.pressed).toBe(false)
  })

  it('divides the travel by the speed and scales by modifiers', () => {
    const { target, deltas } = mountScrub({ speed: 2 })
    press(target, 100)
    move(110)
    move(120, { ctrlKey: true })
    move(130, { shiftKey: true })
    release()

    // 10px / 2 = 5, then ×0.1 with Ctrl and ×10 with Shift.
    expect(deltas).toEqual([5, 0.5, 50])
  })

  it('re-anchors when a modifier changes mid-drag, without drift', () => {
    const { target, deltas } = mountScrub()
    press(target, 100)
    move(101)
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }),
    )
    move(102, { ctrlKey: true })
    release()

    expect(deltas).toEqual([1 / DEFAULT_DRAG_SPEED, 0, 0.1 / DEFAULT_DRAG_SPEED])
  })

  it('ignores moves and keys after release', () => {
    const { target, deltas, events } = mountScrub()
    press(target, 100)
    release()
    move(150)
    window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true }))

    expect(deltas).toEqual([])
    expect(events).toEqual(['start', 'end'])
  })

  it('keeps a stationary press a click, and any travel a drag', () => {
    const small = mountScrub()
    press(small.target, 100)
    dblclick(small.target)
    expect(small.events).toContain('edit')

    const large = mountScrub()
    press(large.target, 100)
    move(100 + SCRUB_DRAG_THRESHOLD)
    dblclick(large.target)
    expect(large.events).not.toContain('edit')
    expect(large.events).toEqual(['start', 'end'])
  })

  it('opens the editor on a plain double-click', () => {
    const { target, events } = mountScrub()
    dblclick(target)
    expect(events).toEqual(['edit'])
  })

  it('stops listening once destroyed mid-drag', () => {
    const { target, scrub, deltas } = mountScrub()
    press(target, 100)
    scrub.destroy()
    expect(scrub.pressed).toBe(false)

    const before = deltas.length
    expect(() => {
      move(140)
      release()
    }).not.toThrow()
    expect(deltas.length).toBe(before)
  })

  it('registers the resize cursor on its target', () => {
    const { stage, target } = mountScrub()
    const hit = stage.getIntersection({ x: 50, y: 18 })
    expect(hit).toBe(target)

    stage.setPointersPositions(
      new MouseEvent('pointermove', { clientX: 50, clientY: 18 }),
    )
    applyStageCursor(stage)
    expect(stage.content.style.cursor).toBe(SCRUB_CURSOR)
  })
})

describe('normalizeSpeed', () => {
  it('falls back to the slow default for missing or invalid speeds', () => {
    for (const speed of [
      undefined,
      0,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(normalizeSpeed(speed)).toBe(DEFAULT_DRAG_SPEED)
    }
    expect(normalizeSpeed(4)).toBe(4)
  })
})
