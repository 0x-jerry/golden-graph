import type { GraphTheme } from './types'

/**
 * Apply a theme's chrome colors to an element as `--gr-*` custom properties.
 * The Vue components consume `var(--gr-color-*)`, so setting these on the
 * renderer root makes them follow the theme live (CSS vars inherit).
 */
export function applyThemeToElement(el: HTMLElement, theme: GraphTheme): void {
  const { colors } = theme
  const vars: Record<string, string> = {
    '--gr-color-accent': colors.accent,
    '--gr-color-border': colors.border,
    '--gr-color-surface': colors.surface,
    '--gr-color-text': colors.textPrimary,
    '--gr-color-text-primary': colors.textPrimary,
    '--gr-color-text-muted': colors.textMuted,
    '--gr-color-bg-toolbar': colors.bgToolbar,
    '--gr-color-bg-hover': colors.bgHover,
    '--gr-color-bg-input': colors.bgInput,
    '--gr-color-bg-preview': colors.bgPreview,
    '--gr-color-canvas-bg': colors.bg,
  }
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value)
  }
}
