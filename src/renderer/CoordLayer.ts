import Konva from 'konva'
import type { CoordSystem } from '../core'
import { COLORS } from './types'

export function createCoordLayer(coord: CoordSystem): Konva.Layer {
  const layer = new Konva.Layer()
  layer.name('grid')

  renderGrid(layer, coord)

  return layer
}

function renderGrid(layer: Konva.Layer, _coord: CoordSystem) {
  const gridSize = 40

  for (let x = 0; x < 4000; x += gridSize) {
    layer.add(new Konva.Line({
      points: [x, 0, x, 4000],
      stroke: COLORS.GRID_COLOR,
      strokeWidth: 1,
      listening: false,
    }))
  }

  for (let y = 0; y < 4000; y += gridSize) {
    layer.add(new Konva.Line({
      points: [0, y, 4000, y],
      stroke: COLORS.GRID_COLOR,
      strokeWidth: 1,
      listening: false,
    }))
  }
}
