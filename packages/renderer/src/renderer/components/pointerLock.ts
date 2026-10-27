/**
 * Pointer lock for a drag gesture — the browser's own version of what a scene
 * editor calls "cursor grab": the pointer stops moving on screen and the
 * browser reports raw travel instead, so the drag can run past the window edge
 * and the pointer reappears exactly where it was locked.
 *
 * Locking is a request, not a guarantee: it needs a browser that supports it,
 * a user gesture (the press), and — inside a frame — the container's
 * permission. Every refusal is swallowed, so a drag without the lock keeps
 * working with plain pointer positions and a hidden CSS cursor.
 */
export class PointerLock {
  _element: Element | null = null

  /** Whether the browser is currently holding the pointer for this element. */
  get locked(): boolean {
    const element = this._element
    return !!element && element.ownerDocument?.pointerLockElement === element
  }

  /** Ask the browser to lock the pointer on `element`. */
  request(element: Element | null | undefined): void {
    if (!element) return
    const target = element as unknown as {
      requestPointerLock?: () => void | Promise<void>
    }
    if (typeof target.requestPointerLock !== 'function') return

    this._element = element
    try {
      const result = target.requestPointerLock()
      // Newer browsers report refusal through the returned promise; drop the
      // claim so callers fall back to the plain pointer position.
      if (result && typeof result.then === 'function') {
        result.catch(() => {
          this._element = null
        })
      }
    } catch {
      this._element = null
    }
  }

  /** Give the pointer back, at the place it was locked. */
  release(): void {
    const element = this._element
    this._element = null
    const doc = element?.ownerDocument
    if (!element || !doc || doc.pointerLockElement !== element) return
    doc.exitPointerLock()
  }
}
