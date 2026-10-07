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
  it('honors custom show/hide delays and cancels a pending show on leave', () => {
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

      // Leaving before the show delay cancels the pending show.
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

  it('keeps visible on quick re-enter and does not restart showDelay while hovering', () => {
    vi.useFakeTimers()
    const t = makeTooltip({ showDelay: 100, hideDelay: 200 })
    try {
      t.target.fire('mouseover')
      vi.advanceTimersByTime(100)
      expect(isVisible()).toBe(true)

      // Re-enter within hideDelay keeps it visible.
      t.target.fire('mouseleave')
      vi.advanceTimersByTime(100)
      t.target.fire('mouseover')
      vi.advanceTimersByTime(500)
      expect(isVisible()).toBe(true)

      // Hide fully, then a repeated mouseover must not restart the delay.
      t.target.fire('mouseleave')
      vi.advanceTimersByTime(200)
      expect(isVisible()).toBe(false)

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
