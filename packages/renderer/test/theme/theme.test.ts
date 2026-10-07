import { describe, it, expect } from 'vitest'
import { DEFAULT_THEME, ThemeContext, applyThemeToElement } from '../../src/theme'

describe('DEFAULT_THEME', () => {
  // A deliberate look pin, not an invariant: restyling the default is
  // expected, but it must be a conscious edit rather than a silent drift.
  it('ships the paper-print look', () => {
    expect(DEFAULT_THEME.colors.bg).toBe('#fdfcf7')
    expect(DEFAULT_THEME.colors.border).toBe('#1f2328')
    expect(DEFAULT_THEME.metrics.nodeShadowBlur).toBe(0)
    expect(DEFAULT_THEME.metrics.nodeShadowOffsetY).toBe(3)
    expect(DEFAULT_THEME.metrics.jointShape).toBe('diamond')
  })
})

describe('ThemeContext', () => {
  it('merges partial themes, hot-swaps listeners and unsubscribes', () => {
    const ctx = new ThemeContext({ colors: { accent: '#ff0000' } })
    expect(ctx.value.colors.accent).toBe('#ff0000')
    expect(ctx.value.colors.bg).toBe(DEFAULT_THEME.colors.bg)

    const seen: string[] = []
    const off = ctx.onThemeChange(() => seen.push(ctx.value.colors.accent))

    ctx.setTheme({ colors: { accent: '#00ff00' } })
    ctx.setTheme({ colors: { accent: '#0000ff' } })
    expect(seen).toEqual(['#00ff00', '#0000ff'])

    off()
    ctx.setTheme({ colors: { accent: '#123456' } })
    expect(seen).toEqual(['#00ff00', '#0000ff'])
  })
})

describe('applyThemeToElement', () => {
  it('maps color tokens to --gr-* custom properties', () => {
    const el = document.createElement('div')
    applyThemeToElement(el, {
      ...DEFAULT_THEME,
      colors: { ...DEFAULT_THEME.colors, accent: '#ff0000' },
    })
    expect(el.style.getPropertyValue('--gr-color-accent')).toBe('#ff0000')
    expect(el.style.getPropertyValue('--gr-color-text-primary')).toBe(
      DEFAULT_THEME.colors.textPrimary,
    )
    expect(el.style.getPropertyValue('--gr-color-text')).toBe(
      DEFAULT_THEME.colors.textPrimary,
    )
  })
})
