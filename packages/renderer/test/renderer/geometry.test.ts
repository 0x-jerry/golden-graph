import { describe, it, expect } from 'vitest'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { makeNode, addHandle } from '../helpers/entities'
import { getJointPos, bezierOffset } from '../../src/renderer/EdgeView'
import { getNodeHeight } from '../../src/renderer/nodeMetrics'
import {
  getNodeWidth,
  LAYOUT,
  NODE_BODY_PADDING,
} from '../../src/renderer/constants'

describe('getJointPos', () => {
  it('places a joint on its side at the node edge and handle row', () => {
    const node = makeNode(1, 'A', { x: 100, y: 50 })
    const left = addHandle(node, 'in', {
      position: HandlePosition.Left,
      type: 'text',
    })

    const pos = getJointPos(left)
    expect(pos.x).toBe(100)
    expect(pos.y).toBe(50 + LAYOUT.HEADER_HEIGHT + LAYOUT.HANDLE_ROW_HEIGHT / 2)

    // lower handles offset by row
    const second = addHandle(node, 'b', {
      position: HandlePosition.Left,
      type: 'text',
    })
    expect(getJointPos(second).y).toBe(
      50 +
        LAYOUT.HEADER_HEIGHT +
        LAYOUT.HANDLE_ROW_HEIGHT +
        LAYOUT.HANDLE_ROW_HEIGHT / 2,
    )

    // block handles sit at the inline row position
    const blockNode = makeNode(8, 'D', { x: 0, y: 0 })
    addHandle(blockNode, 'a', { position: HandlePosition.Left, type: 'text' })
    const block = addHandle(blockNode, 'b', {
      position: HandlePosition.Left,
      type: 'display',
    })
    expect(getJointPos(block).y).toBe(
      LAYOUT.HEADER_HEIGHT +
        LAYOUT.HANDLE_ROW_HEIGHT +
        LAYOUT.HANDLE_ROW_HEIGHT / 2,
    )
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
})

describe('bezierOffset', () => {
  it('clamps to minimum and to half the horizontal distance', () => {
    const far = bezierOffset({ x: 0, y: 0 }, { x: 1000, y: 0 })
    expect(far.handleOffset).toBe(200)

    const near = bezierOffset({ x: 0, y: 0 }, { x: 10, y: 0 })
    expect(near.handleOffset).toBe(10)
  })
})

describe('node dimensions', () => {
  it('falls back to layout width, grows for block handles and respects an explicit size', () => {
    const node = makeNode(5, 'D')
    addHandle(node, 'a', { type: 'text' })
    addHandle(node, 'b', { type: 'text' })

    expect(getNodeWidth(node)).toBe(LAYOUT.NODE_WIDTH)
    expect(getNodeHeight(node)).toBe(
      LAYOUT.HEADER_HEIGHT + 2 * LAYOUT.HANDLE_ROW_HEIGHT + NODE_BODY_PADDING,
    )

    const block = makeNode(7, 'D')
    addHandle(block, 'a', { type: 'text' })
    // 'display' uses the block layout by default.
    addHandle(block, 'b', { type: 'display' })
    expect(getNodeHeight(block)).toBe(
      LAYOUT.HEADER_HEIGHT + 3 * LAYOUT.HANDLE_ROW_HEIGHT + NODE_BODY_PADDING,
    )

    const sized = makeNode(6, 'D')
    addHandle(sized, 'a', { type: 'text' })
    sized.setSize({ x: 400, y: 500 })
    expect(getNodeWidth(sized)).toBe(400)
    expect(getNodeHeight(sized)).toBe(500)
  })
})
