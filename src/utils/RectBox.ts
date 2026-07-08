export interface IRect {
  x: number
  y: number
  width: number
  height: number
}

export class RectBox {
  x: number
  y: number
  width: number
  height: number

  get left() {
    return this.x
  }

  get top() {
    return this.y
  }

  get right() {
    return this.x + this.width
  }

  get bottom() {
    return this.y + this.height
  }

  constructor(opts: { x?: number; y?: number; width?: number; height?: number } = {}) {
    this.x = opts.x ?? 0
    this.y = opts.y ?? 0
    this.width = opts.width ?? 0
    this.height = opts.height ?? 0
  }

  static fromRectBox(opts: { left: number; top: number; right: number; bottom: number }) {
    return new RectBox({ x: opts.left, y: opts.top, width: opts.right - opts.left, height: opts.bottom - opts.top })
  }

  includes(box: RectBox) {
    return (
      this.left <= box.left &&
      this.right >= box.right &&
      this.top <= box.top &&
      this.bottom >= box.bottom
    )
  }
}
