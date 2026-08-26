import { describe, expect, it } from 'vitest'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { makeNode, addHandle } from '../helpers/entities'
import {
  clearMeasuredRowHeight,
  getBlockContentMaxHeight,
  getHandleRowHeight,
  getNodeStaticMinHeight,
  handleY,
  setMeasuredRowHeight,
} from '../../src/renderer/handles/layout'
import { getHandleFactory } from '../../src/renderer/handles'
import { LAYOUT, NODE_BODY_PADDING } from '../../src/renderer/constants'

describe('getHandleRowHeight', () => {
  it('uses HANDLE_ROW_HEIGHT for inline handles', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'text' })
    expect(getHandleRowHeight(handle)).toBe(LAYOUT.HANDLE_ROW_HEIGHT)
  })

  it('defaults block rows to label row + content row', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })
    expect(getHandleRowHeight(handle)).toBe(LAYOUT.HANDLE_ROW_HEIGHT * 2)
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

  it('skips the label row for label-less, position-less block handles', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', {
      position: HandlePosition.None,
      type: 'display',
    })
    expect(getHandleRowHeight(handle)).toBe(LAYOUT.HANDLE_ROW_HEIGHT)
  })

  it('adds the label row for label-less block handles with a position', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', {
      position: HandlePosition.Left,
      type: 'display',
    })
    expect(getHandleRowHeight(handle)).toBe(LAYOUT.HANDLE_ROW_HEIGHT * 2)
  })

  it('keeps auto-height rows at their static minimum with tall content', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })

    // Always-contain: measured content never grows an auto-height node.
    setMeasuredRowHeight(handle, 200)
    expect(getHandleRowHeight(handle)).toBe(LAYOUT.HANDLE_ROW_HEIGHT * 2)

    clearMeasuredRowHeight(handle)
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

  it('keeps rows at their static minimum when the node is too short', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })
    node.setSize({ x: 200, y: 60 })
    // 60 - header(30) - padding(8) = 22 available < static row (56) → the row
    // holds its minimum and the overflow is clipped by the node body.
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
  it('contains block content to minHeight on auto-height nodes', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })
    expect(getBlockContentMaxHeight(node, handle)).toBe(
      LAYOUT.HANDLE_ROW_HEIGHT,
    )
  })

  it('gives a manual-size row the free space after the rows above it', () => {
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
  it('is header + padding + every row at its static minimum', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'txt', { type: 'text' }) // inline: HANDLE_ROW_HEIGHT
    addHandle(node, 'disp', { type: 'display' }) // block: label + content row

    const expected =
      LAYOUT.HEADER_HEIGHT +
      NODE_BODY_PADDING +
      LAYOUT.HANDLE_ROW_HEIGHT +
      LAYOUT.HANDLE_ROW_HEIGHT * 2
    expect(getNodeStaticMinHeight(node)).toBe(expected)
  })

  it('ignores measured content heights', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })
    setMeasuredRowHeight(handle, 200)

    expect(getNodeStaticMinHeight(node)).toBe(
      LAYOUT.HEADER_HEIGHT + NODE_BODY_PADDING + LAYOUT.HANDLE_ROW_HEIGHT * 2,
    )
  })
})

describe('collapsed nodes', () => {
  it('hides every handle row', () => {
    const node = makeNode(1, 'N')
    const a = addHandle(node, 'a', { type: 'display' })
    const b = addHandle(node, 'b', { type: 'text' })
    node.setCollapsed(true)

    // Hidden rows occupy no space and must not throw for missing slots.
    expect(getHandleRowHeight(a)).toBe(0)
    expect(getHandleRowHeight(b)).toBe(0)
  })

  it('docks every handle at the header center', () => {
    const node = makeNode(1, 'N')
    const a = addHandle(node, 'a', { type: 'display' })
    const b = addHandle(node, 'b', { type: 'text' })
    node.setCollapsed(true)

    expect(handleY(node, a)).toBe(LAYOUT.HEADER_HEIGHT / 2)
    expect(handleY(node, b)).toBe(LAYOUT.HEADER_HEIGHT / 2)
  })

  it('gives collapsed hidden content no box', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })
    node.setCollapsed(true)

    expect(getBlockContentMaxHeight(node, handle)).toBe(0)
  })

  it('collapses the static minimum to the header band', () => {
    const node = makeNode(1, 'N')
    addHandle(node, 'a', { type: 'display' })
    node.setCollapsed(true)

    expect(getNodeStaticMinHeight(node)).toBe(LAYOUT.HEADER_HEIGHT)
  })
})
