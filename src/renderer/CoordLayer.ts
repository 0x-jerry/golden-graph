import Konva from 'konva'
import type { CoordSystem } from '../core'
import { COLORS, GRID_SIZE, GRID_EXTENT } from './constants'

export function createCoordLayer(coord: CoordSystem): Konva.Layer {
  const layer = new Konva.Layer()
  layer.name('grid')

  renderGrid(layer, coord)

  return layer
}

function renderGrid(layer: Konva.Layer, _coord: CoordSystem) {
  for (let x = 0; x < GRID_EXTENT; x += GRID_SIZE) {
    layer.add(
      new Konva.Line({
        points: [x, 0, x, GRID_EXTENT],
        stroke: COLORS.GRID_COLOR,
        strokeWidth: 1,
        listening: false,
      }),
    )
  }

  for (let y = 0; y < GRID_EXTENT; y += GRID_SIZE) {
    layer.add(
      new Konva.Line({
        points: [0, y, GRID_EXTENT, y],
        stroke: COLORS.GRID_COLOR,
        strokeWidth: 1,
        listening: false,
      }),
    )
  }
}
