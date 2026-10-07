import { describe, expect, it } from 'vitest'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { makeNode, addHandle } from '../helpers/entities'
import {
  clearMeasuredRowHeight,
  getBlockContentMaxHeight,
  getHandleOrder,
  getHandleRowHeight,
  getNodeStaticMinHeight,
  handleY,
  setMeasuredRowHeight,
} from '../../src/renderer/handles/layout'
import { getHandleFactory } from '../../src/renderer/handles'
import { LAYOUT, NODE_BODY_PADDING } from '../../src/renderer/constants'

describe('getHandleRowHeight', () => {
  it('resolves row height by handle kind and position', () => {
    const node = makeNode(1, 'N')
    const inline = addHandle(node, 'a', { type: 'text' })
    expect(getHandleRowHeight(inline)).toBe(LAYOUT.HANDLE_ROW_HEIGHT)

    const block = addHandle(node, 'b', { type: 'display' })
    expect(getHandleRowHeight(block)).toBe(LAYOUT.HANDLE_ROW_HEIGHT * 2)

    // label-less + position-less block rows skip the label row
    const noLabelNoPos = addHandle(node, 'c', {
      position: HandlePosition.None,
      type: 'display',
    })
    expect(getHandleRowHeight(noLabelNoPos)).toBe(LAYOUT.HANDLE_ROW_HEIGHT)

    // label-less but positioned block rows keep it
    const noLabelWithPos = addHandle(node, 'd', {
      position: HandlePosition.Left,
      type: 'display',
    })
    expect(getHandleRowHeight(noLabelWithPos)).toBe(
      LAYOUT.HANDLE_ROW_HEIGHT * 2,
    )
  })

  it('respects config.minHeight for block rows', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })
    const factory = getHandleFactory('display')!
    const prev = factory.config?.minHeight

    factory.config = { ...factory.config, minHeight: 80 }
    try {
      expect(getHandleRowHeight(handle)).toBe(LAYOUT.HANDLE_ROW_HEIGHT + 80)
    } finally {
      if (prev === undefined) {
        const { minHeight: _drop, ...rest } = factory.config!
        factory.config = rest
      } else {
        factory.config = { ...factory.config, minHeight: prev }
      }
    }
  })

  it('keeps rows at their static minimum with tall content or a short node', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })

    // Always-contain: measured content never grows an auto-height node.
    setMeasuredRowHeight(handle, 200)
    expect(getHandleRowHeight(handle)).toBe(LAYOUT.HANDLE_ROW_HEIGHT * 2)

    clearMeasuredRowHeight(handle)
    expect(getHandleRowHeight(handle)).toBe(LAYOUT.HANDLE_ROW_HEIGHT * 2)

    // 60 - header(30) - padding(8) = 22 available < static row (56) → the row
    // holds its minimum and the overflow is clipped by the node body.
    node.setSize({ x: 200, y: 60 })
    expect(getHandleRowHeight(handle)).toBe(LAYOUT.HANDLE_ROW_HEIGHT * 2)
  })

  it('caps a block row to the vertical space a manual size affords', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })
    node.setSize({ x: 200, y: 150 })

    setMeasuredRowHeight(handle, 200)
    // 150 - header(30) - padding(8) = 112 available; the row claims it all.
    expect(getHandleRowHeight(handle)).toBe(112)

    clearMeasuredRowHeight(handle)
    expect(getHandleRowHeight(handle)).toBe(LAYOUT.HANDLE_ROW_HEIGHT * 2)
  })

  it('resolves rows top-down, giving each the remaining space', () => {
    const node = makeNode(1, 'N')
    const a = addHandle(node, 'a', { type: 'display' })
    const b = addHandle(node, 'b', { type: 'display' })
    node.setSize({ x: 200, y: 300 })

    const remaining = 300 - LAYOUT.HEADER_HEIGHT - NODE_BODY_PADDING
    expect(remaining).toBe(262)

    const staticRow = LAYOUT.HANDLE_ROW_HEIGHT * 2
    expect(getHandleRowHeight(a)).toBe(staticRow)
    expect(getHandleRowHeight(b)).toBe(staticRow)
  })

  it('throws when the handle is stale', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })
    // Simulate a stale handle: still referencing a node that no longer
    // contains it in {@link Node#handles}.
    handle.setNode(makeNode(2, 'other'))

    expect(() => getHandleRowHeight(handle)).toThrow(
      "Handle 'a' not found in node 'other'",
    )
  })
})

describe('getBlockContentMaxHeight', () => {
  it('limits block content to the space the node affords', () => {
    const auto = makeNode(1, 'N')
    const autoHandle = addHandle(auto, 'a', { type: 'display' })
    expect(getBlockContentMaxHeight(auto, autoHandle)).toBe(
      LAYOUT.HANDLE_ROW_HEIGHT,
    )

    const node = makeNode(1, 'N')
    const a = addHandle(node, 'a', { type: 'display' })
    const b = addHandle(node, 'b', { type: 'display' })
    node.setSize({ x: 200, y: 300 })

    const remaining = 300 - LAYOUT.HEADER_HEIGHT - NODE_BODY_PADDING
    const staticRow = LAYOUT.HANDLE_ROW_HEIGHT * 2

    // `a` can claim all free space beyond its label row.
    expect(getBlockContentMaxHeight(node, a)).toBe(
      remaining - LAYOUT.HANDLE_ROW_HEIGHT,
    )
    // `b` only gets what's left after `a` took its static row.
    expect(getBlockContentMaxHeight(node, b)).toBe(
      remaining - staticRow - LAYOUT.HANDLE_ROW_HEIGHT,
    )
  })

  it('throws when the handle is foreign', () => {
    const node = makeNode(1, 'N')
    const foreign = addHandle(makeNode(2, 'other'), 'a', {
      type: 'display',
    })
    node.setSize({ x: 200, y: 300 })

    // A handle that isn't in this node's order is a programming error — it
    // must not borrow the first row's geometry.
    expect(() => getBlockContentMaxHeight(node, foreign)).toThrow(
      "Handle 'a' not found in node 'N'",
    )
  })
})

describe('getNodeStaticMinHeight', () => {
  it('is header + padding + every row at its static minimum, ignoring measurements', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'txt', { type: 'text' }) // inline: HANDLE_ROW_HEIGHT
    const disp = addHandle(node, 'disp', { type: 'display' }) // block: label + content

    const expected =
      LAYOUT.HEADER_HEIGHT +
      NODE_BODY_PADDING +
      LAYOUT.HANDLE_ROW_HEIGHT +
      LAYOUT.HANDLE_ROW_HEIGHT * 2
    expect(getNodeStaticMinHeight(node)).toBe(expected)

    setMeasuredRowHeight(disp, 200)
    expect(getNodeStaticMinHeight(node)).toBe(expected)
  })
})

describe('collapsed nodes', () => {
  it('hides every row and docks handles at the header center', () => {
    const node = makeNode(1, 'N')
    const a = addHandle(node, 'a', { type: 'display' })
    const b = addHandle(node, 'b', { type: 'text' })
    node.setCollapsed(true)

    // Hidden rows occupy no space and must not throw for missing slots.
    expect(getHandleRowHeight(a)).toBe(0)
    expect(getHandleRowHeight(b)).toBe(0)
    expect(handleY(node, a)).toBe(LAYOUT.HEADER_HEIGHT / 2)
    expect(handleY(node, b)).toBe(LAYOUT.HEADER_HEIGHT / 2)
  })

  it('gives collapsed hidden content no box and collapses the min to the header', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })
    node.setCollapsed(true)

    expect(getBlockContentMaxHeight(node, handle)).toBe(0)
    expect(getNodeStaticMinHeight(node)).toBe(LAYOUT.HEADER_HEIGHT)
  })
})

describe('getHandleOrder', () => {
  it('returns the absolute row index mixing positioned + none handles', () => {
    const node = makeNode(4, 'D')
    const p1 = addHandle(node, 'p1', { position: HandlePosition.Left })
    const p2 = addHandle(node, 'p2', { position: HandlePosition.Left })
    const none = addHandle(node, 'row', { position: HandlePosition.None })
    const p3 = addHandle(node, 'p3', { position: HandlePosition.Left })

    const order = getHandleOrder(node)
    expect(order.indexOf(p1)).toBe(0)
    expect(order.indexOf(p2)).toBe(1)
    expect(order.indexOf(p3)).toBe(2)
    expect(order.indexOf(none)).toBe(3)
  })
})
