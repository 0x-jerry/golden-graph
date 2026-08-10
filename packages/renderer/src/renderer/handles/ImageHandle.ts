import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { LAYOUT, HANDLE_CONTENT_X, getNodeWidth } from '../constants'
import { resetStageCursor, setStageCursor } from '../cursor'
import { notifyContentResized } from '../HandleView'
import type { NodeHandleFactory, NodeHandleModule } from './types'

let sharedFileInput: HTMLInputElement | null = null
let currentHandle: NodeHandle | null = null

class ImageModule extends Konva.Group implements NodeHandleModule {
  _handle: NodeHandle

  constructor(handle: NodeHandle) {
    super()
    this._handle = handle

    this.renderValue()

    this.on('pointerdown', (evt) => {
      // Left button only — right/middle clicks should not open the picker
      // (the context menu handles those).
      if (evt.evt.button !== 0) return
      pickImage(handle)
    })
    this.on('mouseover pointerover', setPointerCursor)
    this.on('mouseout pointerout', resetCursor)
  }

  update(): void {
    // Skip the (async) image reload when the value did not change — but still
    // re-fit the drawn image to the current handle width (the node may have resized).
    if (this.getAttr(VALUE_ATTR) !== this._handle.getValue()) {
      this.renderValue()
      return
    }

    this.syncWidth()
    const konvaImage = this.findOne<Konva.Image>('.image')
    if (konvaImage) {
      this.fitImage(konvaImage)
    }
  }

  destroy(): this {
    resetCursor(this)
    return super.destroy()
  }

  renderValue(): void {
    this.destroyChildren()

    const value = this._handle.getValue() as string | undefined
    this.setAttr(VALUE_ATTR, value)

    // Full-width invisible anchor so `HandleView._layoutContent` measures the
    // block width even while the image is still loading asynchronously —
    // otherwise the right-aligned offset is computed against a zero-width group.
    const anchor = new Konva.Rect({
      name: 'anchor',
      width: this.handleWidth(),
      height: 1,
      listening: false,
    })
    this.add(anchor)

    if (value) {
      const img = new Image()
      img.src = value
      img.onload = () => {
        // A newer value may have been rendered while this image was loading —
        // drop the stale result so old images don't stack on top of new ones.
        if (this.getAttr(VALUE_ATTR) !== value) {
          return
        }
        const konvaImage = new Konva.Image({ image: img, name: 'image' })
        this.fitImage(konvaImage)
        this.add(konvaImage)
        notifyContentResized(this)
        this.getLayer()?.batchDraw()
      }
    } else {
      const placeholder = new Konva.Text({
        name: 'placeholder',
        text: 'Click to choose image',
        fontSize: 11,
        fill: '#9aa0aa',
        align: 'center',
        verticalAlign: 'middle',
        width: this.handleWidth(),
      })
      this.add(placeholder)
      notifyContentResized(this)
    }

    this.getLayer()?.batchDraw()
  }

  /** Available width for the image content, mirroring block handles. */
  handleWidth(): number {
    return getNodeWidth(this._handle.node) - LAYOUT.HANDLE_PADDING * 2
  }

  /**
   * Keep the width-driven children (measurement anchor, placeholder text) in
   * sync with the current node width. Runs on every update so `_layoutContent`
   * measures the handle correctly when the node is resized, even while the
   * handle is empty or its image is still loading.
   */
  syncWidth(): void {
    const w = this.handleWidth()
    this.findOne<Konva.Rect>('.anchor')?.width(w)
    this.findOne<Konva.Text>('.placeholder')?.width(w)
  }

  /**
   * Scale the image down (never up) to fit the handle width and position it so
   * it renders centered in the node. The anchor rect makes the content group
   * span the full block width, so `HandleView._layoutContent` aligns its origin
   * to the same left/right edges as the block-layout label.
   */
  fitImage(konvaImage: Konva.Image): void {
    this.syncWidth()

    const img = konvaImage.image() as HTMLImageElement
    const w = this.handleWidth()
    const scale = Math.min(1, w / img.width)
    const imgW = img.width * scale
    konvaImage.width(imgW)
    konvaImage.height(img.height * scale)
    konvaImage.x(this.centeredX(imgW))
    konvaImage.y(0)
  }

  /** Local x that makes the image center sit on the node center line. */
  centeredX(imgW: number): number {
    const handle = this._handle
    const w = getNodeWidth(handle.node)
    const center = w / 2
    const originX =
      handle.position === HandlePosition.Right
        ? w - HANDLE_CONTENT_X - this.handleWidth()
        : handle.position === HandlePosition.Left
          ? HANDLE_CONTENT_X
          : LAYOUT.HANDLE_PADDING
    return center - imgW / 2 - originX
  }
}

export const imageHandleFactory: NodeHandleFactory = {
  type: 'image',
  config: {
    layout: 'block',
    joint: { color: '#f97316', shape: 'diamond' },
  },
  create: (handle) => new ImageModule(handle),

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

function setPointerCursor(evt: Konva.KonvaEventObject<Event>) {
  setStageCursor(evt.target, 'pointer')
}

function resetCursor(node: Konva.Node | Konva.KonvaEventObject<Event>) {
  resetStageCursor(node instanceof Konva.Node ? node : node.target)
}

const VALUE_ATTR = 'imageValue'
