/**
 * Minimal rAF tween backing the renderer's transitions: the scrollbar fade and
 * the dropdown open/close.
 *
 * Every animated target is a Konva shape painted into a canvas — there is no
 * DOM element for the Web Animations API to animate — and each effect only
 * needs elapsed time plus one easing curve applied to a single number. This
 * module provides exactly that, with no dependency.
 */

/** Easing curve, mapping linear progress `0..1` to eased progress. */
export type EaseFn = (t: number) => number

/** Identity easing. */
export const linear: EaseFn = (t) => t

/** Decelerating: use while something appears. */
export const outQuad: EaseFn = (t) => t * (2 - t)

/** Accelerating: use while something disappears. */
export const inQuad: EaseFn = (t) => t * t

/** Duration of one scrollbar fade-in/out. */
export const SCROLLBAR_FADE_MS = 160
/** Duration of the dropdown open/close transition. */
export const DROPDOWN_TOGGLE_MS = 160
/** Screen-pixel travel of the dropdown slide (the caller compensates zoom). */
export const DROPDOWN_SLIDE_PX = 6

/** Whether the OS asks for reduced motion. jsdom has no `matchMedia`. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  const matchMedia = window.matchMedia
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Duration an animation should use. `0` when the consumer disabled animations
 * or the OS asks for reduced motion; {@link Animator} turns a zero duration
 * into an immediate, synchronous snap.
 */
export function animationDuration(ms: number, enabled: boolean): number {
  if (!enabled || ms <= 0) {
    return 0
  }
  return prefersReducedMotion() ? 0 : ms
}

export interface AnimationOptions {
  from: number
  to: number
  /** Milliseconds; `0` (or no rAF support) settles synchronously. */
  duration: number
  ease?: EaseFn
  onFrame: (value: number) => void
  onDone?: () => void
}

function now(): number {
  return typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

/**
 * One scalar tween.
 *
 * A `setTimeout` matching the duration is the authority on the end state: it
 * stops the frame loop, applies `to` and fires `onDone`. rAF is throttled or
 * suspended in background tabs, so completion must not depend on frame
 * delivery — this also makes the outcome exact under fake timers.
 *
 * A zero duration — animations disabled or reduced motion — or a missing
 * `requestAnimationFrame` settles synchronously in the constructor, so the
 * instance is already {@link finished} when it is handed back.
 */
export class Animator {
  /** Value the tween started from. */
  readonly from: number
  /** Value the tween ends at. */
  readonly to: number
  /** Duration in milliseconds; `0` means it settled on construction. */
  readonly duration: number

  _frame: number | null = null
  _settleTimer: ReturnType<typeof setTimeout> | null = null
  _start: number | null = null
  _finished = false
  _ease: EaseFn
  _onFrame: (value: number) => void
  _onDone?: () => void

  _finish = (): void => {
    if (this._finished) return
    this._finished = true
    this._stop()
    this._onFrame(this.to)
    this._onDone?.()
  }

  _step = (timestamp?: number): void => {
    if (this._finished) return
    const time = typeof timestamp === 'number' ? timestamp : now()
    // The first frame defines the origin, so the caller's `from` is what the
    // very first `onFrame` reports.
    if (this._start === null) this._start = time
    const progress = Math.min(1, (time - this._start) / this.duration)
    if (progress >= 1) {
      this._finish()
      return
    }
    this._onFrame(this.from + (this.to - this.from) * this._ease(progress))
    this._frame = requestAnimationFrame(this._step)
  }

  constructor(options: AnimationOptions) {
    const { from, to, duration, ease = outQuad, onFrame, onDone } = options
    this.from = from
    this.to = to
    this.duration = duration
    this._ease = ease
    this._onFrame = onFrame
    this._onDone = onDone

    if (duration <= 0 || typeof requestAnimationFrame !== 'function') {
      this._finish()
      return
    }

    this._frame = requestAnimationFrame(this._step)
    this._settleTimer = setTimeout(this._finish, duration)
  }

  /** Whether the tween reached its end (or settled on construction). */
  get finished(): boolean {
    return this._finished
  }

  /** Stop the tween where it is. Does not fire `onDone`. */
  cancel(): void {
    if (this._finished) return
    this._finished = true
    this._stop()
  }

  _stop(): void {
    if (this._frame !== null) {
      cancelAnimationFrame(this._frame)
      this._frame = null
    }
    if (this._settleTimer !== null) {
      clearTimeout(this._settleTimer)
      this._settleTimer = null
    }
  }
}

/**
 * Start a scalar tween.
 *
 * Returns the running {@link Animator}, or `null` when there is nothing to
 * run: a zero duration (animations disabled, reduced motion) or no rAF support
 * settles synchronously, so callers can keep their idle state and skip
 * cancelling.
 */
export function animateProgress(options: AnimationOptions): Animator | null {
  const animator = new Animator(options)
  return animator.finished ? null : animator
}
