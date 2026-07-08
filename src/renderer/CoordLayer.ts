import Konva from 'konva'
import type { CoordSystem } from '../core'
import { COLORS, LAYER_NAME } from './constants'

const GRID_SIZE = 40
const GRID_RANGE = 10_000

export function createCoordLayer(coord: CoordSystem): Konva.Layer {
  const layer = new Konva.Layer({ name: LAYER_NAME.GRID })

  renderGrid(layer, coord)

  return layer
}

function renderGrid(layer: Konva.Layer, _coord: CoordSystem) {
  for (let x = -GRID_RANGE; x < GRID_RANGE; x += GRID_SIZE) {
    layer.add(
      new Konva.Line({
        points: [x, -GRID_RANGE, x, GRID_RANGE],
        stroke: COLORS.GRID_COLOR,
        strokeWidth: 1,
        listening: false,
      }),
    )
  }

  for (let y = -GRID_RANGE; y < GRID_RANGE; y += GRID_SIZE) {
    layer.add(
      new Konva.Line({
        points: [-GRID_RANGE, y, GRID_RANGE, y],
        stroke: COLORS.GRID_COLOR,
        strokeWidth: 1,
        listening: false,
      }),
    )
  }
}
