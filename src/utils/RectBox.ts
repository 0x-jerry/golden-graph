export interface IRect {
  x: number
  y: number
  width: number
  height: number
}

export interface IRectBox {
  left: number
  top: number
  right: number
  bottom: number
}

export class RectBox {
  x: number
  y: number
  width: number
  height: number

  get left() {
    return this.x
  }

  set left(value) {
    this.x = value
  }

  get top() {
    return this.y
  }

  set top(value) {
    this.y = value
  }

  get right() {
    return this.x + this.width
  }

  set right(value) {
    this.width = value - this.x
  }

  get bottom() {
    return this.y + this.height
  }

  set bottom(value) {
    this.height = value - this.y
  }

  constructor(x: number=0, y: number=0, width: number =0,height: number =0) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  static fromRectBox(left: number, top: number, right: number, bottom: number) {
    return new RectBox(left, top, right - left, bottom - top)
  }

  includes(box: RectBox) {
    return this.left <= box.left && this.right >= box.right && this.top <= box.top && this.bottom >= box.bottom
  }
}