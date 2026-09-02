import { COLORS, EXECUTOR_SHADOW_BLUR } from '../renderer/constants'
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
} from '../renderer/components/shared'
import type { GraphTheme } from './types'

/**
 * Default theme. Derived from the existing `COLORS`/layout constants so the
 * default appearance is unchanged and `COLORS.*` assertions in tests still
 * hold (DEFAULT_THEME.colors is the same palette).
 */
export const DEFAULT_THEME: GraphTheme = {
  colors: {
    bg: COLORS.BG,
    border: COLORS.BORDER,
    headerBg: COLORS.HEADER_BG,
    textPrimary: COLORS.TEXT_PRIMARY,
    textLabel: COLORS.TEXT_LABEL,
    textMuted: COLORS.TEXT_MUTED,
    accent: COLORS.ACCENT,
    accentSoft: COLORS.ACCENT_SOFT,
    subgraphTagBg: COLORS.SUBGRAPH_TAG_BG,
    subgraphTagText: COLORS.SUBGRAPH_TAG_TEXT,
    edge: COLORS.EDGE,
    jointDefault: COLORS.JOINT_DEFAULT,
    jointHighlight: COLORS.JOINT_HIGHLIGHT,
    groupBg: COLORS.GROUP_BG,
    groupBorder: COLORS.GROUP_BORDER,
    groupHeaderBg: COLORS.GROUP_HEADER_BG,
    gridColor: COLORS.GRID_COLOR,
    selectionBorder: COLORS.SELECTION_BORDER,
    selectionFill: COLORS.SELECTION_FILL,
    surface: '#ffffff',
    bgToolbar: 'rgba(255, 255, 255, 0.92)',
    bgHover: 'rgba(0, 0, 0, 0.05)',
    bgInput: '#f6f6f8',
    bgPreview: '#fafafb',
  },
  fonts: {
    family: DEFAULT_FONT_FAMILY,
    size: DEFAULT_FONT_SIZE,
  },
  metrics: {
    edgeWidth: COLORS.EDGE_WIDTH,
    executorShadowBlur: EXECUTOR_SHADOW_BLUR,
    nodeCornerRadius: 0,
    groupCornerRadius: 0,
  },
}
