import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { HandleModule } from './types'

export class ImageHandle extends HandleModule {
  static type = 'image'

  _sharedFileInput: HTMLInputElement | null = null
  _currentHandle: NodeHandle | null = null

  create: HandleModule['create'] = (handle) => {
    const group = new Konva.Group()

    this._renderValue(group, handle)

    group.on('click', () => {
      this._pickImage(handle)
    })

    return group
  }

  update: HandleModule['update'] = (group, handle) => {
    // Skip the (async) image reload when the value did not change.
    if (group.getAttr(VALUE_ATTR) === handle.getValue()) {
      return
    }

    this._renderValue(group, handle)
  }

  /** Remove the shared file input from the DOM when the renderer is disposed. */
  dispose() {
    this._sharedFileInput?.remove()
    this._sharedFileInput = null
    this._currentHandle = null
  }

  _getSharedFileInput(): HTMLInputElement {
    if (!this._sharedFileInput) {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.style.display = 'none'
      document.body.appendChild(input)

      input.addEventListener('change', () => {
        const file = input.files?.[0]
        if (file && this._currentHandle) {
          const reader = new FileReader()
          reader.onload = () => {
            this._currentHandle?.setValue(reader.result)
            this._currentHandle = null
          }
          reader.readAsDataURL(file)
        }

        // Allow picking the same file again.
        input.value = ''
      })

      this._sharedFileInput = input
    }
    return this._sharedFileInput
  }

  _pickImage(handle: NodeHandle) {
    this._currentHandle = handle
    this._getSharedFileInput().click()
  }

  _renderValue(group: Konva.Group, handle: NodeHandle) {
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
        fill: '#999999',
        align: 'center',
        verticalAlign: 'middle',
        width: MAX_WIDTH,
      })
      group.add(placeholder)
    }

    group.getLayer()?.batchDraw()
  }
}

const MAX_WIDTH = 180
const VALUE_ATTR = 'imageValue'