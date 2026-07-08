import Konva from 'konva'
import type { CoordSystem } from '../core'
import { COLORS } from './constants'

const GRID_SIZE = 40
const GRID_EXTENT = 10_000

export function createCoordLayer(coord: CoordSystem): Konva.Layer {
  const layer = new Konva.Layer()
  layer.name('grid')

  renderGrid(layer, coord)

  return layer
}

function renderGrid(layer: Konva.Layer, _coord: CoordSystem) {
  for (let x = -GRID_EXTENT; x < GRID_EXTENT; x += GRID_SIZE) {
    layer.add(
      new Konva.Line({
        points: [x, -GRID_EXTENT, x, GRID_EXTENT],
        stroke: COLORS.GRID_COLOR,
        strokeWidth: 1,
        listening: false,
      }),
    )
  }

  for (let y = -GRID_EXTENT; y < GRID_EXTENT; y += GRID_SIZE) {
    layer.add(
      new Konva.Line({
        points: [-GRID_EXTENT, y, GRID_EXTENT, y],
        stroke: COLORS.GRID_COLOR,
        strokeWidth: 1,
        listening: false,
      }),
    )
  }
}
