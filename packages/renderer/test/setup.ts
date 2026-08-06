import { createCanvas, DOMMatrix } from 'canvas'

// jsdom lacks OffscreenCanvas/DOMMatrix/ResizeObserver; the canvas package
// provides the first two, the renderer needs a no-op observer.
globalThis.OffscreenCanvas = globalThis.OffscreenCanvas || createCanvas
globalThis.DOMMatrix = globalThis.DOMMatrix || DOMMatrix
if (!globalThis.ResizeObserver) {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = RO
}
