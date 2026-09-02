/**
 * Semantic color tokens. The Konva-side set mirrors the historic `COLORS`
 * constant; the trailing `surface/bg*` tokens are consumed only by the CSS
 * chrome (toolbar, context menu, dialogs) via `--gr-*` custom properties.
 */
export interface ThemeColors {
  bg: string
  border: string
  headerBg: string
  textPrimary: string
  textLabel: string
  textMuted: string
  accent: string
  accentSoft: string
  subgraphTagBg: string
  subgraphTagText: string
  edge: string
  jointDefault: string
  jointHighlight: string
  groupBg: string
  groupBorder: string
  groupHeaderBg: string
  gridColor: string
  selectionBorder: string
  selectionFill: string
  /** CSS-chrome-only tokens. */
  surface: string
  bgToolbar: string
  bgHover: string
  bgInput: string
  bgPreview: string
}

export interface ThemeFonts {
  /** Font family applied to every canvas text node. */
  family: string
  /**
   * Base text size in px. Applied at construction to all text (designed
   * offsets preserved: names +1, subgraph tag −2, image label −1) and
   * re-applied live by `applyTheme`, which re-centers text within its box.
   */
  size: number
}

/**
 * Visual-only layout metrics. Geometry-affecting constants (node/handle
 * widths & heights, joint radius, paddings) stay in `constants.ts` — they feed
 * handle layout and node/edge geometry and are not hot-swappable.
 */
export interface ThemeMetrics {
  edgeWidth: number
  executorShadowBlur: number
  nodeCornerRadius: number
  groupCornerRadius: number
}

export interface GraphTheme {
  colors: ThemeColors
  fonts: ThemeFonts
  metrics: ThemeMetrics
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}
