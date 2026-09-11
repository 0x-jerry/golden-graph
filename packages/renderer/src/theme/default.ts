import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
} from '../renderer/components/shared'
import type { GraphTheme } from './types'

/**
 * Default theme: the "paper print" look — off-white block, inked 1px outline,
 * hard offset shadow, ruled header/row separators and diamond joints.
 *
 * This is the single source of truth for the shipped look: every value the
 * renderer can read from a theme is written out here, and `ThemeContext`
 * merges caller overrides on top of it.
 */
export const DEFAULT_THEME: GraphTheme = {
  colors: {
    bg: '#fdfcf7',
    border: '#1f2328',
    headerBg: '#f4f1e8',
    headerText: '#1f2328',
    headerDivider: '#1f2328',
    rowDivider: 'rgba(31, 35, 40, 0.18)',
    nodeShadow: 'rgba(31, 35, 40, 0.85)',
    jointRing: '#fdfcf7',
    textPrimary: '#1f2328',
    textLabel: '#3f444a',
    textMuted: '#6b6f76',
    accent: '#b3261e',
    accentSoft: 'rgba(179, 38, 30, 0.22)',
    subgraphTagBg: '#eae5d8',
    subgraphTagText: '#5b4a2f',
    edge: 'rgba(74, 107, 138, 0.75)',
    jointDefault: '#4a6b8a',
    jointHighlight: '#b3261e',
    groupBg: 'rgba(31, 35, 40, 0.03)',
    groupBorder: 'rgba(31, 35, 40, 0.55)',
    groupHeaderBg: 'rgba(31, 35, 40, 0.07)',
    gridColor: '#ece7dc',
    selectionBorder: '#6366f1',
    selectionFill: 'rgba(99, 102, 241, 0.12)',
    surface: '#fdfcf7',
    bgToolbar: 'rgba(253, 252, 247, 0.94)',
    bgHover: 'rgba(31, 35, 40, 0.07)',
    bgInput: '#f4f1e8',
    bgPreview: '#faf8f2',
  },
  fonts: {
    family: DEFAULT_FONT_FAMILY,
    size: DEFAULT_FONT_SIZE,
  },
  metrics: {
    edgeWidth: 2,
    executorShadowBlur: 10,
    nodeCornerRadius: 3,
    groupCornerRadius: 3,
    headerInset: 0,
    headerCornerRadius: 0,
    nodeShadowBlur: 0,
    nodeShadowOffsetX: 3,
    nodeShadowOffsetY: 3,
    jointShape: 'diamond',
    jointRingWidth: 0,
    edgeDash: [10, 5],
  },
}
