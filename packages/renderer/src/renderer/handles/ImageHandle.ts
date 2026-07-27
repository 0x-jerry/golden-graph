import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import type { HandleModule } from './types'

export const type = 'image'

const MAX_WIDTH = 180
const VALUE_ATTR = 'imageValue'

let sharedFileInput: HTMLInputElement | null = null
let currentHandle: NodeHandle | null = null

function getSharedFileInput(): HTMLInputElement {
  if (!sharedFileInput) {
    sharedFileInput = document.createElement('input')
    sharedFileInput.type = 'file'
    sharedFileInput.accept = 'image/*'
    sharedFileInput.style.display = 'none'
    document.body.appendChild(sharedFileInput)

    sharedFileInput.addEventListener('change', () => {
      const file = sharedFileInput!.files?.[0]
      if (file && currentHandle) {
        const reader = new FileReader()
        reader.onload = () => {
          currentHandle?.setValue(reader.result)
          currentHandle = null
        }
        reader.readAsDataURL(file)
      }

      // Allow picking the same file again.
      sharedFileInput!.value = ''
    })
  }
  return sharedFileInput
}

function pickImage(handle: NodeHandle) {
  currentHandle = handle
  getSharedFileInput().click()
}

export function dispose() {
  sharedFileInput?.remove()
  sharedFileInput = null
  currentHandle = null
}

function renderValue(group: Konva.Group, handle: NodeHandle) {
  group.destroyChildren()

  const value = handle.getValue() as string | undefined
  group.setAttr(VALUE_ATTR, value)

  if (value) {
    const img = new Image()
    img.src = value
    img.onload = () => {
      const scale = Math.min(1, MAX_WIDTH / img.width)
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
      width: MAX_WIDTH,
    })
    group.add(placeholder)
  }

  group.getLayer()?.batchDraw()
}

export const create: HandleModule['create'] = (handle) => {
  const group = new Konva.Group()

  renderValue(group, handle)

  group.on('click', () => {
    pickImage(handle)
  })

  return group
}

export const update: HandleModule['update'] = (group, handle) => {
  // Skip the (async) image reload when the value did not change.
  if (group.getAttr(VALUE_ATTR) === handle.getValue()) {
    return
  }

  renderValue(group, handle)
}
