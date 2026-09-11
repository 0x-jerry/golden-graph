import { describe, it, expect, vi } from 'vitest'
import Konva from 'konva'
import { Tooltip, disposeTooltip } from '../../src/renderer/tooltip'
import { makeStage } from '../helpers/stage'

function tooltipEl(): HTMLDivElement | null {
  return document.querySelector<HTMLDivElement>('.r-graph-tooltip')
}

function isVisible(): boolean {
  return tooltipEl()?.style.display === 'block'
}

function makeTooltip(options: { showDelay: number; hideDelay: number }) {
  const { stage, layer, container } = makeStage(1)
  const target = new Konva.Group()
  layer.add(target)
  const tooltip = new Tooltip(target, { text: 'value', ...options })
  return {
    target,
    tooltip,
    dispose() {
      tooltip.destroy()
      stage.destroy()
      container.remove()
      disposeTooltip()
    },
  }
}

describe('Tooltip delays', () => {
  it('honors custom showDelay and hideDelay', () => {
    vi.useFakeTimers()
    const t = makeTooltip({ showDelay: 100, hideDelay: 200 })
    try {
      t.target.fire('mouseover')
      vi.advanceTimersByTime(99)
      expect(isVisible()).toBe(false)

      vi.advanceTimersByTime(1)
      expect(isVisible()).toBe(true)

      t.target.fire('mouseleave')
      vi.advanceTimersByTime(199)
      expect(isVisible()).toBe(true)

      vi.advanceTimersByTime(1)
      expect(isVisible()).toBe(false)
    } finally {
      t.dispose()
      vi.useRealTimers()
    }
  })

  it('cancels a pending show when the pointer leaves before the delay', () => {
    vi.useFakeTimers()
    const t = makeTooltip({ showDelay: 100, hideDelay: 200 })
    try {
      t.target.fire('mouseover')
      vi.advanceTimersByTime(50)
      t.target.fire('mouseleave')
      vi.advanceTimersByTime(1000)
      expect(isVisible()).toBe(false)
    } finally {
      t.dispose()
      vi.useRealTimers()
    }
  })

  it('keeps the tooltip visible when the pointer re-enters within hideDelay', () => {
    vi.useFakeTimers()
    const t = makeTooltip({ showDelay: 100, hideDelay: 200 })
    try {
      t.target.fire('mouseover')
      vi.advanceTimersByTime(100)
      expect(isVisible()).toBe(true)

      t.target.fire('mouseleave')
      vi.advanceTimersByTime(100)
      t.target.fire('mouseover')
      vi.advanceTimersByTime(500)
      expect(isVisible()).toBe(true)
    } finally {
      t.dispose()
      vi.useRealTimers()
    }
  })

  it('does not restart showDelay on repeated mouseover while hovering', () => {
    vi.useFakeTimers()
    const t = makeTooltip({ showDelay: 100, hideDelay: 200 })
    try {
      t.target.fire('mouseover')
      vi.advanceTimersByTime(60)
      // A child hand-off fires `mouseover` again.
      t.target.fire('mouseover')
      vi.advanceTimersByTime(40)
      expect(isVisible()).toBe(true)
    } finally {
      t.dispose()
      vi.useRealTimers()
    }
  })
})
