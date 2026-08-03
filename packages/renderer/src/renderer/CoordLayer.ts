import Konva from 'konva'
import type { CoordSystem } from '@0x-jerry/golden-graph'
import { COLORS, LAYER_NAME } from './constants'

const GRID_SIZE = 40
const GRID_RANGE = 10_000

/**
 * Static dot-grid layer. The grid pattern never changes with the coordinate
 * transform, so it is rendered once and only redrawn on a full render.
 */
export class CoordLayer extends Konva.Layer {
  constructor(_coord: CoordSystem) {
    super({ name: LAYER_NAME.GRID })
    this.render()
  }

  render(): void {
    this.destroyChildren()

    const tile = new OffscreenCanvas(GRID_SIZE, GRID_SIZE)
    const ctx = tile.getContext('2d')!
    ctx.fillStyle = COLORS.GRID_COLOR
    ctx.beginPath()
    ctx.arc(GRID_SIZE / 2, GRID_SIZE / 2, 1.5, 0, Math.PI * 2)
    ctx.fill()

    this.add(
      new Konva.Rect({
        x: -GRID_RANGE,
        y: -GRID_RANGE,
        width: GRID_RANGE * 2,
        height: GRID_RANGE * 2,
        fillPatternImage: tile as unknown as HTMLImageElement,
        listening: false,
      }),
    )
  }
}