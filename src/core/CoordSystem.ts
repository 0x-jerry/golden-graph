import type { IPersistent } from "./Persistent";
import type { ICoordinate, IVec2 } from "./types";

export class CoordSystem implements IPersistent<ICoordinate> {
  /**
   * Coord system origin position
   */
  origin = {
    x: 0,
    y: 0,
  };

  scale = 1;

  zoomAt(point: IVec2, scale: number) {
    const dx = point.x / scale - point.x / this.scale;
    const dy = point.y / scale - point.y / this.scale;

    this.origin.x += dx;
    this.origin.y += dy;

    this.scale = scale;
  }

  move(x: number, y: number) {
    this.origin.x += x / this.scale;
    this.origin.y += y / this.scale;
  }

  /**
   * Covert coord system to screen system
   */
  x(rawX: number): number {
    return (this.origin.x + rawX) * this.scale;
  }

  /**
   * Covert coord system to screen system
   */
  y(rawY: number): number {
    return (this.origin.y + rawY) * this.scale;
  }

  getCoordStyle(pos: IVec2) {
    return {
      "--x": `${this.x(pos.x)}px`,
      "--y": `${this.y(pos.y)}px`,
      "--scale": this.scale,
    };
  }

  toJSON(): ICoordinate {
    throw new Error("Method not implemented.");
  }

  fromJSON(data: ICoordinate): void {
    throw new Error("Method not implemented.");
  }
}
