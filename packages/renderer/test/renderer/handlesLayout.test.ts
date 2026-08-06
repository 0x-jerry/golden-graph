import { describe, expect, it } from 'vitest'
import { makeNode, addHandle } from '../helpers/entities'
import {
  clearMeasuredRowHeight,
  getHandleRowHeight,
  setMeasuredRowHeight,
} from '../../src/renderer/handles/layout'
import { getHandleModule } from '../../src/renderer/handles'
import { BLOCK_HANDLE_LABEL_ROW, LAYOUT } from '../../src/renderer/constants'

describe('getHandleRowHeight', () => {
  it('uses HANDLE_ROW_HEIGHT for inline handles', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'text' })
    expect(getHandleRowHeight(handle)).toBe(LAYOUT.HANDLE_ROW_HEIGHT)
  })

  it('defaults block rows to label row + content row', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })
    expect(getHandleRowHeight(handle)).toBe(
      BLOCK_HANDLE_LABEL_ROW + LAYOUT.HANDLE_ROW_HEIGHT,
    )
  })

  it('respects config.minHeight for block rows', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })
    const module = getHandleModule('display')!
    const prev = module.config?.minHeight

    module.config = { ...module.config, minHeight: 80 }
    try {
      expect(getHandleRowHeight(handle)).toBe(BLOCK_HANDLE_LABEL_ROW + 80)
    } finally {
      if (prev === undefined) {
        const { minHeight: _drop, ...rest } = module.config!
        module.config = rest
      } else {
        module.config = { ...module.config, minHeight: prev }
      }
    }
  })

  it('returns the measured row when it exceeds the static minimum', () => {
    const node = makeNode(1, 'N')
    const handle = addHandle(node, 'a', { type: 'display' })

    setMeasuredRowHeight(handle, 200)
    expect(getHandleRowHeight(handle)).toBe(200)

    clearMeasuredRowHeight(handle)
    expect(getHandleRowHeight(handle)).toBe(
      BLOCK_HANDLE_LABEL_ROW + LAYOUT.HANDLE_ROW_HEIGHT,
    )
  })
})
