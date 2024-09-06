export interface IVec2 {
  x: number
  y: number
}

export class Vec2 implements IVec2 {
  static up = new Vec2(0, -1)
  static down = new Vec2(0, 1)

  static left = new Vec2(-1, 0)
  static right = new Vec2(1, 0)

  static zero = new Vec2(0, 0)

  x = 0
  y = 0

  constructor(x: number = 0, y = x) {
    this.x = x
    this.y = y
  }
}
