import Konva from 'konva'
import type { CoordSystem } from '@0x-jerry/golden-graph'
import { COLORS, LAYER_NAME } from './constants'

const GRID_SIZE = 40
const GRID_RANGE = 10_000

export function createCoordLayer(_coord: CoordSystem): Konva.Layer {
  const layer = new Konva.Layer({ name: LAYER_NAME.GRID })

  renderGrid(layer)

  return layer
}

function renderGrid(layer: Konva.Layer) {
  const tile = new OffscreenCanvas(GRID_SIZE, GRID_SIZE)
  const ctx = tile.getContext('2d')!
  ctx.fillStyle = COLORS.GRID_COLOR
  ctx.beginPath()
  ctx.arc(GRID_SIZE / 2, GRID_SIZE / 2, 1.5, 0, Math.PI * 2)
  ctx.fill()

  layer.add(
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
