import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import type { HandleModule } from './types'

let sharedFileInput: HTMLInputElement | null = null
let currentHandle: NodeHandle | null = null

export const imageHandle: HandleModule = {
  type: 'image',
  config: { layout: 'block' },

  create: (handle) => {
    const group = new Konva.Group()

    renderValue(group, handle)

    group.on('click', () => {
      pickImage(handle)
    })

    return group
  },

  update: (group, handle) => {
    // Skip the (async) image reload when the value did not change.
    if (group.getAttr(VALUE_ATTR) === handle.getValue()) {
      return
    }

    renderValue(group, handle)
  },

  /** Remove the shared file input from the DOM when the renderer is disposed. */
  dispose() {
    sharedFileInput?.remove()
    sharedFileInput = null
    currentHandle = null
  },
}

function getSharedFileInput(): HTMLInputElement {
  if (!sharedFileInput) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    document.body.appendChild(input)

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (file && currentHandle) {
        const reader = new FileReader()
        reader.onload = () => {
          currentHandle?.setValue(reader.result)
          currentHandle = null
        }
        reader.readAsDataURL(file)
      }

      // Allow picking the same file again.
      input.value = ''
    })

    sharedFileInput = input
  }
  return sharedFileInput
}

function pickImage(handle: NodeHandle) {
  currentHandle = handle
  getSharedFileInput().click()
}

function renderValue(group: Konva.Group, handle: NodeHandle) {
  group.destroyChildren()

  const value = handle.getValue() as string | undefined
  group.setAttr(VALUE_ATTR, value)

  if (value) {
    const img = new Image()
    img.src = value
    img.onload = () => {
      // A newer value may have been rendered while this image was loading —
      // drop the stale result so old images don't stack on top of new ones.
      if (group.getAttr(VALUE_ATTR) !== value) {
        return
      }
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
      fill: '#9aa0aa',
      align: 'center',
      verticalAlign: 'middle',
      width: MAX_WIDTH,
    })
    group.add(placeholder)
  }

  group.getLayer()?.batchDraw()
}

const MAX_WIDTH = 180
const VALUE_ATTR = 'imageValue'
