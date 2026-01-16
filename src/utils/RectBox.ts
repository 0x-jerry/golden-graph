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

  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  static fromRectBox(left: number, top: number, right: number, bottom: number) {
    return new RectBox(left, top, right - left, bottom - top)
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
