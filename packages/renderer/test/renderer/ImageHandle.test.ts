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

  it('contains tall images, never upscales and anchors top-center', () => {
    const availableW = 200 - LAYOUT.HANDLE_PADDING * 2
    const boxH =
      200 - LAYOUT.HEADER_HEIGHT - NODE_BODY_PADDING - LAYOUT.HANDLE_ROW_HEIGHT

    const portrait = makeSizedImageNode(200, 200)
    const tall = mockImage(400, 800)
    fit(portrait.module, tall)
    const scale = Math.min(1, availableW / 400, boxH / 800)
    expect(tall.width()).toBeCloseTo(400 * scale)
    expect(tall.height()).toBeCloseTo(800 * scale)
    // Aspect ratio is preserved — the height constraint dominates.
    expect(tall.height() / tall.width()).toBeCloseTo(2)

    const small = makeSizedImageNode(200, 200)
    const fitting = mockImage(60, 30)
    fit(small.module, fitting)
    expect(fitting.width()).toBe(60)
    expect(fitting.height()).toBe(30)

    // Landscape image: the width constraint binds, so it hugs the row top.
    const wide = makeSizedImageNode(200, 200)
    const landscape = mockImage(800, 200)
    fit(wide.module, landscape)
    expect(landscape.width()).toBeCloseTo(availableW)
    expect(landscape.height()).toBeLessThan(boxH)
    expect(landscape.y()).toBe(0)
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