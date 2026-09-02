import { describe, it, expect } from 'vitest'
import { DEFAULT_THEME, ThemeContext, applyThemeToElement } from '../../src/theme'

describe('DEFAULT_THEME', () => {
  it('keeps the default palette identical to COLORS', () => {
    expect(DEFAULT_THEME.colors.accent).toBe('#6366f1')
    expect(DEFAULT_THEME.colors.bg).toBe('#ffffff')
    expect(DEFAULT_THEME.colors.border).toBe('#d9d9de')
  })
})

describe('ThemeContext', () => {
  it('merges partial theme over defaults', () => {
    const ctx = new ThemeContext({ colors: { accent: '#ff0000' } })
    expect(ctx.value.colors.accent).toBe('#ff0000')
    expect(ctx.value.colors.bg).toBe(DEFAULT_THEME.colors.bg)
  })

  it('notifies listeners on setTheme and hot-swaps in place', () => {
    const ctx = new ThemeContext()
    const seen: string[] = []
    ctx.onThemeChange(() => seen.push(ctx.value.colors.accent))

    ctx.setTheme({ colors: { accent: '#00ff00' } })
    ctx.setTheme({ colors: { accent: '#0000ff' } })

    expect(seen).toEqual(['#00ff00', '#0000ff'])
  })

  it('unsubscribes a listener', () => {
    const ctx = new ThemeContext()
    let calls = 0
    const off = ctx.onThemeChange(() => calls++)
    off()
    ctx.setTheme({ colors: { accent: '#ff0000' } })
    expect(calls).toBe(0)
  })
})

describe('applyThemeToElement', () => {
  it('maps color tokens to --gr-* custom properties', () => {
    const el = document.createElement('div')
    applyThemeToElement(
      el,
      { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, accent: '#ff0000' } },
    )
    expect(el.style.getPropertyValue('--gr-color-accent')).toBe('#ff0000')
    expect(el.style.getPropertyValue('--gr-color-text-primary')).toBe(
      DEFAULT_THEME.colors.textPrimary,
    )
    expect(el.style.getPropertyValue('--gr-color-text')).toBe(
      DEFAULT_THEME.colors.textPrimary,
    )
  })
})
