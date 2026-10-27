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
import { applyStageCursor, HIDDEN_CURSOR } from '../../src/renderer/cursor'

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

/**
 * A move as a locked pointer reports it: the on-screen position is frozen,
 * so the travel arrives as `movementX` instead. jsdom has no `movementX`,
 * hence the own property.
 */
function moveLocked(movementX: number, clientX: number) {
  const evt = new MouseEvent('mousemove', { clientX, clientY: 20 })
  Object.defineProperty(evt, 'movementX', { value: movementX })
  window.dispatchEvent(evt)
}

interface FakeLock {
  readonly requests: number
  readonly releases: number
  /** Whether the fake browser is holding the pointer, and for what. */
  readonly holder: Element | null
  restore(): void
}

/**
 * A stand-in for the browser pointer lock API. `grant: false` models a
 * browser (or an embedding frame) that refuses the lock.
 */
function fakePointerLock(stage: Konva.Stage, grant = true): FakeLock {
  const state = { requests: 0, releases: 0, holder: null as Element | null }
  const content = stage.content
  // Patched through narrow views so the added members can be removed again.
  const lockable = content as unknown as {
    requestPointerLock?: () => Promise<void>
  }
  const doc = document as unknown as {
    exitPointerLock?: () => void
    pointerLockElement?: Element | null
  }
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true,
    get: () => state.holder,
  })
  lockable.requestPointerLock = () => {
    state.requests++
    if (!grant) return Promise.reject(new Error('denied'))
    state.holder = content
    return Promise.resolve()
  }
  doc.exitPointerLock = () => {
    state.releases++
    state.holder = null
  }
  return {
    get requests() {
      return state.requests
    },
    get releases() {
      return state.releases
    },
    get holder() {
      return state.holder
    },
    restore() {
      delete lockable.requestPointerLock
      delete doc.exitPointerLock
      delete doc.pointerLockElement
    },
  }
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

  it('keeps a stationary press a click, and travel past the threshold a drag', () => {
    const small = mountScrub()
    press(small.target, 100)
    dblclick(small.target)
    expect(small.events).toContain('edit')

    // A shaky press — the usual double-click — stays a click.
    const shaky = mountScrub()
    press(shaky.target, 100)
    move(100 + SCRUB_DRAG_THRESHOLD - 1)
    dblclick(shaky.target)
    expect(shaky.events).toContain('edit')

    const large = mountScrub()
    press(large.target, 100)
    move(100 + SCRUB_DRAG_THRESHOLD)
    dblclick(large.target)
    expect(large.events).not.toContain('edit')
    expect(large.events).toEqual(['start', 'end'])
  })

  it('hides the pointer while dragging and puts it back on release', () => {
    const { stage, target } = mountScrub()
    stage.setPointersPositions(
      new MouseEvent('pointermove', { clientX: 50, clientY: 18 }),
    )
    applyStageCursor(stage)
    expect(stage.content.style.cursor).toBe(SCRUB_CURSOR)

    press(target, 50)
    // A press alone is not a drag: the pointer stays visible.
    expect(stage.content.style.cursor).toBe(SCRUB_CURSOR)
    move(50 + SCRUB_DRAG_THRESHOLD)
    expect(stage.content.style.cursor).toBe(HIDDEN_CURSOR)

    // A redraw must not bring it back mid-drag.
    applyStageCursor(stage)
    expect(stage.content.style.cursor).toBe(HIDDEN_CURSOR)

    release()
    // Back at the pointer, showing the cursor of whatever is under it.
    expect(stage.content.style.cursor).toBe(SCRUB_CURSOR)
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

describe('Scrub pointer lock', () => {
  it('locks the pointer for the drag and gives it back in place', () => {
    const { stage, target, deltas } = mountScrub()
    const lock = fakePointerLock(stage)
    try {
      press(target, 100)
      // A press alone never locks: a click has to keep its pointer.
      expect(lock.requests).toBe(0)

      move(100 + SCRUB_DRAG_THRESHOLD)
      expect(lock.requests).toBe(1)
      expect(lock.holder).toBe(stage.content)

      // Locked: the pointer stops moving on screen, so the scrub follows the
      // browser's raw travel instead of a frozen client X.
      const seen = deltas.length
      moveLocked(16, 100 + SCRUB_DRAG_THRESHOLD)
      expect(deltas.slice(seen)).toEqual([16 / DEFAULT_DRAG_SPEED])

      release()
      expect(lock.releases).toBe(1)
      expect(document.pointerLockElement).toBe(null)
    } finally {
      lock.restore()
    }
  })

  it('keeps scrubbing by pointer position when the lock is refused', () => {
    const { stage, target, deltas } = mountScrub()
    const lock = fakePointerLock(stage, false)
    try {
      press(target, 100)
      move(100 + SCRUB_DRAG_THRESHOLD)
      expect(lock.requests).toBe(1)
      expect(lock.holder).toBe(null)
      expect(stage.content.style.cursor).toBe(HIDDEN_CURSOR)

      const seen = deltas.length
      move(100 + SCRUB_DRAG_THRESHOLD + 16)
      expect(deltas.slice(seen)).toEqual([16 / DEFAULT_DRAG_SPEED])

      release()
      expect(stage.content.style.cursor).not.toBe(HIDDEN_CURSOR)
    } finally {
      lock.restore()
    }
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
