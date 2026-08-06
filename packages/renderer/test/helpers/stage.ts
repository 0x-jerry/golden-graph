import Konva from 'konva'

export interface StageHarness {
  stage: Konva.Stage
  layer: Konva.Layer
  container: HTMLDivElement
}

export function makeStage(scale: number = 1): StageHarness {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const stage = new Konva.Stage({
    container,
    width: 1000,
    height: 800,
  })
  stage.scale({ x: scale, y: scale })
  const layer = new Konva.Layer()
  stage.add(layer)
  return { stage, layer, container }
}
