/**
 * Semantic color tokens. The Konva-side set drives every canvas view; the
 * trailing `surface/bg*` tokens are consumed only by the CSS chrome (toolbar,
 * context menu, dialogs) via `--gr-*` custom properties.
 */
export interface ThemeColors {
  bg: string
  border: string
  headerBg: string
  /** Node title color — differs from `textPrimary` when the header is a filled bar. */
  headerText: string
  /** Separator under the header band; `''` hides it. */
  headerDivider: string
  /** Separator between handle rows; `''` hides it. */
  rowDivider: string
  /** Static node shadow color; `'transparent'` disables the shadow. */
  nodeShadow: string
  /** Inner fill of a hollow joint; unused while `jointRingWidth` is 0. */
  jointRing: string
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

/** Node body outline. */
export type NodeCornerRadius = number | number[]

/** Geometry of a handle's joint (connection dot). */
export type JointShape = 'circle' | 'square' | 'diamond' | 'triangle'

/**
 * Visual-only layout metrics. Geometry-affecting constants (node/handle
 * widths & heights, joint radius, paddings) stay in `constants.ts` — they feed
 * handle layout and node/edge geometry and are not hot-swappable.
 */
export interface ThemeMetrics {
  edgeWidth: number
  /** Blur radius of the glow drawn on the node currently being executed. */
  executorShadowBlur: number
  nodeCornerRadius: NodeCornerRadius
  groupCornerRadius: number
  /** Inset of the header band from the node bounds; 0 = full-bleed band. */
  headerInset: number
  headerCornerRadius: number
  nodeShadowBlur: number
  nodeShadowOffsetX: number
  nodeShadowOffsetY: number
  /** Joint shape used when a handle type registers no joint config. */
  jointShape: JointShape
  /** Stroke width of a hollow joint; 0 = filled joint. */
  jointRingWidth: number
  /** Edge dash pattern; empty = solid. */
  edgeDash: number[]
}

export interface GraphTheme {
  colors: ThemeColors
  fonts: ThemeFonts
  metrics: ThemeMetrics
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}
