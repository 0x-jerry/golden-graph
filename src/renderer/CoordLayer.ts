import Konva from 'konva'
import type { CoordSystem } from '../core'
import { COLORS, LAYER_NAME } from './constants'

const GRID_SIZE = 40
const GRID_RANGE = 10_000

export function createCoordLayer(_coord: CoordSystem): Konva.Layer {
  const layer = new Konva.Layer({ name: LAYER_NAME.GRID })

  renderGrid(layer)

  return layer
}

function renderGrid(layer: Konva.Layer) {
  const tile = document.createElement('canvas')
  tile.width = GRID_SIZE
  tile.height = GRID_SIZE

  const ctx = tile.getContext('2d')!
  ctx.strokeStyle = COLORS.GRID_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(GRID_SIZE - 0.5, 0)
  ctx.lineTo(GRID_SIZE - 0.5, GRID_SIZE)
  ctx.moveTo(0, GRID_SIZE - 0.5)
  ctx.lineTo(GRID_SIZE, GRID_SIZE - 0.5)
  ctx.stroke()

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
