import Konva from 'konva'
import type { NodeHandle } from '../../core'
import type { HandleModule } from './types'

export const type = 'image'

export const create: HandleModule['create'] = (handle) => {
  const group = new Konva.Group()

  const value = handle.getValue() as string | undefined

  if (value) {
    const img = new Image()
    img.src = value
    img.onload = () => {
      const maxWidth = 180
      const scale = Math.min(1, maxWidth / img.width)
      const konvaImage = new Konva.Image({
        image: img,
        width: img.width * scale,
        height: img.height * scale,
      })
      group.add(konvaImage)
      group.getLayer()?.batchDraw()
    }
  } else {
    const placeholder = new Konva.Text({
      text: 'Click to choose image',
      fontSize: 11,
      fill: '#999999',
      align: 'center',
      verticalAlign: 'middle',
      width: 180,
    })
    group.add(placeholder)
  }

  return group
}

export const update: HandleModule['update'] = (group, handle) => {
  group.destroyChildren()
  const value = handle.getValue() as string | undefined

  if (value) {
    const img = new Image()
    img.src = value
    img.onload = () => {
      const maxWidth = 180
      const scale = Math.min(1, maxWidth / img.width)
      const konvaImage = new Konva.Image({
        image: img,
        width: img.width * scale,
        height: img.height * scale,
      })
      group.add(konvaImage)
      group.getLayer()?.batchDraw()
    }
  } else {
    const placeholder = new Konva.Text({
      text: 'Click to choose image',
      fontSize: 11,
      fill: '#999999',
      align: 'center',
      verticalAlign: 'middle',
      width: 180,
    })
    group.add(placeholder)
  }

  group.getLayer()?.batchDraw()
}
