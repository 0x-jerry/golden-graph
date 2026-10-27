import Konva from 'konva'
import { registerStageCursor } from '../cursor'

/** Stage-container cursor over a scrub surface (Blender's resize arrow). */
export const SCRUB_CURSOR = 'ew-resize'

/**
 * Pointer travel (px) that turns a press into a drag. Below it a gesture stays
 * a click, so a slightly shaky double-click still opens the editor.
 */
export const SCRUB_DRAG_THRESHOLD = 3

export interface ScrubConfig {
  /** Listening node that receives press, drag and double-click. */
  target: Konva.Node
  /**
   * Pixels of travel per unit of `onScrub` delta — the caller expresses its
   * step size through it (`deltaPx * step / speed`). Defaults to
   * {@link DEFAULT_DRAG_SPEED}.
   */
  speed?: number
  /** Fired once on pointer down, before the first `onScrub`. */
  onStart?(): void
  /**
   * Fired with the travel since the previous call, already scaled by the
   * modifier keys (Ctrl/⌘ ×0.1, Shift ×10). Fires once with `0` when a
   * modifier changes mid-drag, so the caller can re-anchor.
   */
  onScrub(deltaPx: number): void
  /** Fired on release, and when a drag swallows a double-click. */
  onEnd?(): void
  /** Fired for a double-click whose press did not drag: open the editor. */
  onEdit(evt: Event): void
}

/**
 * Blender-style numeric scrubbing for a widget: press and drag horizontally to
 * step the value, double-click to hand over to a text editor. The delta is the
 * pointer's own travel, so the value never jumps to where the press landed,
 * and the drag ends on a window-level `mouseup`/`touchend` so a release
 * outside the canvas cannot leave it stuck.
 *
 * The target's press, touch and double-click events are consumed — the stage
 * never sees them, so neither node dragging nor canvas panning starts.
 */
export class Scrub {
  readonly target: Konva.Node

  _cfg: ScrubConfig
  _speed: number
  _pressed = false
  /** Whether the current gesture traveled past {@link SCRUB_DRAG_THRESHOLD}. */
  _dragged = false
  /** Client X the last delta was measured from, and the gesture's origin. */
  _lastX = 0
  _originX = 0
  /** Modifier state of the last emitted move, to detect a change mid-drag. */
  _modifiers = ''

  constructor(cfg: ScrubConfig) {
    this._cfg = cfg
    this._speed = normalizeSpeed(cfg.speed)
    this.target = cfg.target

    this.target.on('mousedown touchstart', this._onDown)
    this.target.on('dblclick', this._onDblClick)

    registerStageCursor(this.target, SCRUB_CURSOR)
  }

  /** Whether a scrub drag is currently in progress. */
  get pressed(): boolean {
    return this._pressed
  }

  destroy(): this {
    this.target.off('mousedown touchstart', this._onDown)
    this.target.off('dblclick', this._onDblClick)
    this._endGesture()
    return this
  }

  _onDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true
    e.evt.stopPropagation?.()
    // Leave DOM focus alone: a double-click that follows this press has to
    // still reach the editor's hidden input, not pull focus to the canvas.
    e.evt.preventDefault?.()

    const x = eventClientX(e.evt)
    if (x === undefined || this._pressed) return

    this._pressed = true
    this._dragged = false
    this._lastX = x
    this._originX = x
    this._modifiers = modifierKey(e.evt)
    this._cfg.onStart?.()
    this._bind()
  }

  _onMove = (e: MouseEvent | TouchEvent) => {
    if (!this._pressed) return
    const x = eventClientX(e)
    if (x === undefined) return

    const delta = (x - this._lastX) / this._speed
    this._lastX = x
    if (x !== this._originX) this._dragged = true
    this._emit(delta, e)
  }

  _onUp = () => {
    this._endGesture()
  }

  /** A modifier change re-anchors the accumulator at the current value. */
  _onKey = (e: KeyboardEvent) => {
    if (!this._pressed) return
    const next = modifierKey(e)
    if (next === this._modifiers) return
    this._modifiers = next
    this._emit(0, e)
  }

  _onDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    e.evt.stopPropagation?.()
    e.evt.preventDefault?.()

    // A press that dragged cannot ask for the editor; it only ends the
    // gesture the double-click's own press started.
    if (this._dragged) {
      this._endGesture()
      return
    }
    this._endGesture()
    this._cfg.onEdit(e.evt)
  }

  _emit(delta: number, evt: MouseEvent | TouchEvent | KeyboardEvent) {
    const scaled =
      delta * (evt.ctrlKey || evt.metaKey ? 0.1 : 1) * (evt.shiftKey ? 10 : 1)
    this._cfg.onScrub(scaled)
  }

  _endGesture() {
    this._unbind()
    if (!this._pressed) return
    this._pressed = false
    this._dragged = false
    this._cfg.onEnd?.()
  }

  _bind() {
    window.addEventListener('mousemove', this._onMove)
    window.addEventListener('touchmove', this._onMove, { passive: true })
    window.addEventListener('mouseup', this._onUp)
    window.addEventListener('touchend', this._onUp)
    window.addEventListener('keydown', this._onKey)
    window.addEventListener('keyup', this._onKey)
  }

  _unbind() {
    window.removeEventListener('mousemove', this._onMove)
    window.removeEventListener('touchmove', this._onMove)
    window.removeEventListener('mouseup', this._onUp)
    window.removeEventListener('touchend', this._onUp)
    window.removeEventListener('keydown', this._onKey)
    window.removeEventListener('keyup', this._onKey)
  }
}

/**
 * Pointer X in client space. Touch events carry no `clientX` on the event
 * itself, so the first changed touch stands in for it.
 */
function eventClientX(evt: MouseEvent | TouchEvent): number | undefined {
  if ('clientX' in evt && typeof evt.clientX === 'number') {
    return evt.clientX
  }
  return (evt as TouchEvent).changedTouches?.[0]?.clientX
}

function modifierKey(evt: MouseEvent | TouchEvent | KeyboardEvent): string {
  return `${evt.ctrlKey ? 'c' : ''}${evt.metaKey ? 'm' : ''}${evt.shiftKey ? 's' : ''}`
}

/**
 * Pixels of travel per step, i.e. the drag sensitivity: the pointer must move
 * `DEFAULT_DRAG_SPEED` pixels to advance one step. Comfortable for fine
 * controls (a 0.001-step roughness takes ~650 px to cross the bar) while
 * Shift still coarsens the drag 10×.
 */
export const DEFAULT_DRAG_SPEED = 8

/** A missing or invalid speed scrubs at {@link DEFAULT_DRAG_SPEED}. */
export function normalizeSpeed(speed: number | undefined): number {
  return typeof speed === 'number' && Number.isFinite(speed) && speed > 0
    ? speed
    : DEFAULT_DRAG_SPEED
}
