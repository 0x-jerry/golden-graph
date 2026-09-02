import { DEFAULT_THEME } from './default'
import type { DeepPartial, GraphTheme } from './types'

function mergeTheme(
  base: GraphTheme,
  patch: DeepPartial<GraphTheme>,
): GraphTheme {
  return {
    colors: { ...base.colors, ...patch.colors },
    fonts: { ...base.fonts, ...patch.fonts },
    metrics: { ...base.metrics, ...patch.metrics },
  }
}

/**
 * Per-renderer theme state. Holds the current override patch and derives the
 * merged `GraphTheme` (defaults + overrides), notifying listeners on `setTheme`
 * so Konva views can hot-swap their styles in place without re-creating.
 *
 * Semantics: `setTheme(patch)` REPLACES the override set — the theme is always
 * `DEFAULT_THEME` merged over exactly the patch you pass, so each call should
 * carry the complete set of overrides (never an incremental delta; the
 * constructor's patch is replaced the same way). The Vue wrapper relies on
 * this: its `theme` prop is a full snapshot, so switching Dark→Light passes `{}`
 * and cleanly resets to defaults.
 *
 * Kept framework-agnostic (no Vue dependency) because the Konva renderer is
 * a plain class.
 */
export class ThemeContext {
  private patch: DeepPartial<GraphTheme>
  private listeners = new Set<() => void>()

  constructor(theme?: DeepPartial<GraphTheme>) {
    this.patch = theme ?? {}
  }

  get value(): GraphTheme {
    return mergeTheme(DEFAULT_THEME, this.patch)
  }

  setTheme(patch: DeepPartial<GraphTheme>): void {
    this.patch = patch
    for (const fn of this.listeners) fn()
  }

  onThemeChange(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
}
