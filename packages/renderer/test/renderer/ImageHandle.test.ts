import { describe, expect, it } from 'vitest'
import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { makeNode, addHandle } from '../helpers/entities'
import { getHandleFactory } from '../../src/renderer/handles'
import type { NodeHandleModule } from '../../src/renderer/handles/types'
import {
  LAYOUT,
  NODE_BODY_PADDING,
} from '../../src/renderer/constants'

/** Invoke the module's internal fit logic via the factory-created instance. */
function fit(module: NodeHandleModule, image: Konva.Image) {
  ;(module as unknown as { fitImage: (i: Konva.Image) => void }).fitImage(
    image,
  )
}

function imageModule(handle: NodeHandle) {
  return getHandleFactory('image')!.create!(handle, {})
}

function mockImage(width: number, height: number) {
  return new Konva.Image({
    image: { width, height } as unknown as HTMLImageElement,
  })
}

describe('ImageHandle block content containment', () => {
  function makeSizedImageNode(width: number, height: number) {
    const node = makeNode(1, 'N')
    addHandle(node, 'img', { type: 'image' })
    node.setSize({ x: width, y: height })
    const module = imageModule(node.getHandle('img')!)
    return { node, module }
  }

  it('contains a tall portrait image into the available content box', () => {
    const { module } = makeSizedImageNode(200, 200)

    const image = mockImage(400, 800)
    fit(module, image)

    // available box: width = 200 - 2*padding; content height = node height
    // minus header, bottom padding and the label row.
    const availableW = 200 - LAYOUT.HANDLE_PADDING * 2
    const boxH =
      200 - LAYOUT.HEADER_HEIGHT - NODE_BODY_PADDING - LAYOUT.HANDLE_ROW_HEIGHT
    const scale = Math.min(1, availableW / 400, boxH / 800)

    expect(image.width()).toBeCloseTo(400 * scale)
    expect(image.height()).toBeCloseTo(800 * scale)
    // Aspect ratio is preserved — the height constraint dominates.
    expect(image.height() / image.width()).toBeCloseTo(2)
  })

  it('never upscales an image that already fits', () => {
    const { module } = makeSizedImageNode(200, 200)

    const image = mockImage(60, 30)
    fit(module, image)

    expect(image.width()).toBe(60)
    expect(image.height()).toBe(30)
  })

  it('anchors top-center when the box is taller than the image', () => {
    const { module } = makeSizedImageNode(200, 200)

    // Landscape image: the width constraint binds, so the drawn image is
    // shorter than the available content box.
    const image = mockImage(800, 200)
    fit(module, image)

    const availableW = 200 - LAYOUT.HANDLE_PADDING * 2
    const boxH =
      200 - LAYOUT.HEADER_HEIGHT - NODE_BODY_PADDING - LAYOUT.HANDLE_ROW_HEIGHT
    expect(image.width()).toBeCloseTo(availableW)
    expect(image.height()).toBeLessThan(boxH)
    // Hugs the content row top instead of floating in the middle of the box.
    expect(image.y()).toBe(0)
  })

  it('shrinks the image when the node is resized smaller', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'img', { type: 'image' })
    node.setSize({ x: 400, y: 300 })
    const module = imageModule(node.getHandle('img')!)

    const image = mockImage(200, 200)
    fit(module, image)
    const before = image.width()

    // A shorter node yields a shorter box, re-containing the image.
    node.setSize({ x: 400, y: 120 })
    fit(module, image)

    expect(image.width()).toBeLessThan(before)
    expect(image.width()).toBeCloseTo(image.height())
  })
})