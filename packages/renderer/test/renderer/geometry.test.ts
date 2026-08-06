import { describe, it, expect } from 'vitest'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { makeNode, addHandle } from '../helpers/entities'
import { getJointPos, bezierOffset } from '../../src/renderer/EdgeView'
import { getHandleIndex, getNodeHeight } from '../../src/renderer/NodeView'
import {
  getNodeWidth,
  LAYOUT,
  NODE_BODY_PADDING,
} from '../../src/renderer/constants'

describe('getJointPos', () => {
  it('places a left joint at the node left edge on its handle row', () => {
    const node = makeNode(1, 'A', { x: 100, y: 50 })
    const handle = addHandle(node, 'in', {
      position: HandlePosition.Left,
      type: 'text',
    })

    const pos = getJointPos(handle)
    expect(pos.x).toBe(100)
    expect(pos.y).toBe(50 + LAYOUT.HEADER_HEIGHT + LAYOUT.HANDLE_ROW_HEIGHT / 2)
  })

  it('places a right joint at the effective node right edge', () => {
    const node = makeNode(2, 'B', { x: 200, y: 0 })
    node.setSize({ x: 300, y: 0 })
    const handle = addHandle(node, 'out', {
      position: HandlePosition.Right,
      type: 'text',
    })

    const pos = getJointPos(handle)
    expect(pos.x).toBe(200 + getNodeWidth(node))
  })

  it('offsets lower handles within a node', () => {
    const node = makeNode(3, 'C', { x: 0, y: 0 })
    addHandle(node, 'a', { position: HandlePosition.Left, type: 'text' })
    const second = addHandle(node, 'b', {
      position: HandlePosition.Left,
      type: 'text',
    })

    const pos = getJointPos(second)
    expect(pos.y).toBe(
      LAYOUT.HEADER_HEIGHT +
        LAYOUT.HANDLE_ROW_HEIGHT +
        LAYOUT.HANDLE_ROW_HEIGHT / 2,
    )
  })

  it('aligns a block handle joint at the inline row position', () => {
    const node = makeNode(8, 'D', { x: 0, y: 0 })
    addHandle(node, 'a', { position: HandlePosition.Left, type: 'text' })
    // 'display' uses the block layout by default.
    const block = addHandle(node, 'b', {
      position: HandlePosition.Left,
      type: 'display',
    })

    const pos = getJointPos(block)
    expect(pos.y).toBe(
      LAYOUT.HEADER_HEIGHT +
        LAYOUT.HANDLE_ROW_HEIGHT +
        LAYOUT.HANDLE_ROW_HEIGHT / 2,
    )
  })
})

describe('bezierOffset', () => {
  it('clamps to minimum and to half the horizontal distance', () => {
    const far = bezierOffset({ x: 0, y: 0 }, { x: 1000, y: 0 })
    expect(far.handleOffset).toBe(200)

    const near = bezierOffset({ x: 0, y: 0 }, { x: 10, y: 0 })
    expect(near.handleOffset).toBe(10)
  })
})

describe('getHandleIndex', () => {
  it('returns the absolute row index mixing positioned + none handles', () => {
    const node = makeNode(4, 'D')
    const p1 = addHandle(node, 'p1', { position: HandlePosition.Left })
    const p2 = addHandle(node, 'p2', { position: HandlePosition.Left })
    const none = addHandle(node, 'row', { position: HandlePosition.None })
    const p3 = addHandle(node, 'p3', { position: HandlePosition.Left })

    expect(getHandleIndex(node, p1)).toBe(0)
    expect(getHandleIndex(node, p2)).toBe(1)
    expect(getHandleIndex(node, p3)).toBe(2)
    expect(getHandleIndex(node, none)).toBe(3)
  })
})

describe('node dimensions', () => {
  it('falls back to layout width and content-driven height', () => {
    const node = makeNode(5, 'D')
    addHandle(node, 'a', { type: 'text' })
    addHandle(node, 'b', { type: 'text' })

    expect(getNodeWidth(node)).toBe(LAYOUT.NODE_WIDTH)
    expect(getNodeHeight(node)).toBe(
      LAYOUT.HEADER_HEIGHT + 2 * LAYOUT.HANDLE_ROW_HEIGHT + NODE_BODY_PADDING,
    )
  })

  it('grows the node for block-layout handles', () => {
    const node = makeNode(7, 'D')
    addHandle(node, 'a', { type: 'text' })
    // 'display' uses the block layout by default.
    addHandle(node, 'b', { type: 'display' })

    expect(getNodeHeight(node)).toBe(
      LAYOUT.HEADER_HEIGHT + 3 * LAYOUT.HANDLE_ROW_HEIGHT + NODE_BODY_PADDING,
    )
  })

  it('respects an explicit size', () => {
    const node = makeNode(6, 'D')
    addHandle(node, 'a', { type: 'text' })

    node.setSize({ x: 400, y: 500 })
    expect(getNodeWidth(node)).toBe(400)
    expect(getNodeHeight(node)).toBe(500)
  })
})
