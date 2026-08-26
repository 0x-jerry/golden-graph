import type { Node, NodeHandle } from '@0x-jerry/golden-graph'
import { HandlePosition } from '@0x-jerry/golden-graph'
import { LAYOUT, NODE_BODY_PADDING } from '../constants'
import { getHandleFactory } from './index'

/** Measured row heights from live `HandleView`s, keyed by handle. */
const measuredRows = new WeakMap<NodeHandle, number>()

export function setMeasuredRowHeight(handle: NodeHandle, height: number) {
  measuredRows.set(handle, height)
}

export function clearMeasuredRowHeight(handle: NodeHandle) {
  measuredRows.delete(handle)
}

/**
 * Whether a block-layout handle renders its label row. A block handle with
 * neither a name nor a position (layout-only) skips the label row entirely, so
 * its content starts at the top of the row. Inline handles always render a row.
 */
export function hasLabelRow(handle: NodeHandle): boolean {
  if (getHandleFactory(handle.type)?.config?.layout !== 'block') {
    return true
  }
  return handle.name !== '' || handle.position !== HandlePosition.None
}

/** Static minimum row height for a handle, ignoring measured content. */
function staticRowHeight(handle: NodeHandle): number {
  const factory = getHandleFactory(handle.type)
  if (factory?.config?.layout !== 'block') {
    return LAYOUT.HANDLE_ROW_HEIGHT
  }
  const minHeight = factory.config?.minHeight ?? LAYOUT.HANDLE_ROW_HEIGHT
  return hasLabelRow(handle) ? LAYOUT.HANDLE_ROW_HEIGHT + minHeight : minHeight
}

/**
 * Row height a handle would like before any node-size cap: the static minimum
 * or the measured content height, whichever is taller. Inline handles are
 * fixed-height.
 */
function desiredRowHeight(handle: NodeHandle): number {
  if (getHandleFactory(handle.type)?.config?.layout !== 'block') {
    return LAYOUT.HANDLE_ROW_HEIGHT
  }
  return Math.max(staticRowHeight(handle), measuredRows.get(handle) ?? 0)
}

/** Per-handle layout result, in render order. */
interface RowLayout {
  /** Final row height — the vertical space the row occupies for stacking. */
  row: number
  /**
   * Max content-box height for a block handle, excluding its label row.
   * Content widgets `contain` themselves into this box, so they can never
   * expand the node.
   */
  box: number
}

/**
 * Resolve the final row heights (and block content boxes) for a node's
 * handles, in render order. Content can never expand the node:
 *
 * - Auto-height nodes (`size.y <= 0`) render every row at its static minimum
 *   and every block content box at the handle's `minHeight`.
 * - Manually sized nodes distribute `size.y` top-down: each row takes its
 *   desired height but never more than the remaining vertical space — and
 *   never less than its static minimum (nodes too small for their rows
 *   overflow and are clipped by the node body). A block row's content box is
 *   the space remaining after the rows above it, so content can claim the
 *   node's slack (e.g. a tall image in a tall node) without ever forcing the
 *   node bigger.
 */
function layoutRows(node: Node): RowLayout[] {
  if (node.collapsed) {
    // Collapsed nodes hide every handle row: the header is the whole node,
    // and hidden handles dock at the header line (see `handleY`).
    return []
  }
  const order = getHandleOrder(node)
  const auto = node.size.y <= 0
  let remaining = node.size.y - LAYOUT.HEADER_HEIGHT - NODE_BODY_PADDING

  return order.map((h) => {
    const factory = getHandleFactory(h.type)
    const isBlock = factory?.config?.layout === 'block'
    const minHeight = factory?.config?.minHeight ?? LAYOUT.HANDLE_ROW_HEIGHT
    const labelRow = hasLabelRow(h) ? LAYOUT.HANDLE_ROW_HEIGHT : 0

    const row = auto
      ? staticRowHeight(h)
      : Math.max(staticRowHeight(h), Math.min(desiredRowHeight(h), remaining))
    const box = !isBlock
      ? row
      : auto
        ? minHeight
        : Math.max(minHeight, remaining - labelRow)

    remaining -= row
    return { row, box }
  })
}

/**
 * Row height a handle occupies, based on its factory's content layout and the
 * node's size. Block content is contained to the node: a block row never
 * exceeds the vertical space the node allocates it, so measured content can
 * never expand the node (see {@link layoutRows} for the exact model).
 * Falls back to the static minimum when no live handle view has measured
 * itself yet. Label-less, position-less block handles skip the label row.
 */
export function getHandleRowHeight(handle: NodeHandle): number {
  if (handle.node.collapsed) {
    // Hidden rows occupy no space; their views stay alive (layer hidden) and
    // read `0` instead of throwing on the missing layout slot.
    return 0
  }
  const factory = getHandleFactory(handle.type)
  if (factory?.config?.layout !== 'block') {
    return LAYOUT.HANDLE_ROW_HEIGHT
  }
  const rows = layoutRows(handle.node)
  const index = getHandleOrder(handle.node).indexOf(handle)
  // A handle missing from its node's order is a programming error (stale
  // handle, foreign node) — surface it instead of returning wrong geometry.
  if (index < 0) {
    throw new Error(
      `Handle '${handle.key}' not found in node '${handle.node.name}'`,
    )
  }
  return rows[index]!.row
}

/**
 * Max height of a block handle's content area, excluding its label row. The
 * content widget should `contain` itself into this box (together with the
 * width its row spans) so it respects the node's size instead of expanding
 * it. Never smaller than the handle's `minHeight`.
 */
export function getBlockContentMaxHeight(
  node: Node,
  handle: NodeHandle,
): number {
  if (node.collapsed) {
    return 0
  }
  const rows = layoutRows(node)
  const index = getHandleOrder(node).indexOf(handle)
  if (index < 0) {
    throw new Error(`Handle '${handle.key}' not found in node '${node.name}'`)
  }
  return rows[index]!.box
}

/**
 * Static minimum content height of a node: header + bottom padding + every
 * handle row at its static minimum. The resize grip keeps a node at least
 * this tall, so block rows never collapse onto each other — tall measured
 * content is still contained/clipped above this minimum (see
 * {@link layoutRows}).
 */
export function getNodeStaticMinHeight(node: Node): number {
  if (node.collapsed) {
    return LAYOUT.HEADER_HEIGHT
  }
  let height = LAYOUT.HEADER_HEIGHT + NODE_BODY_PADDING
  for (const handle of node.handles) {
    height += staticRowHeight(handle)
  }
  return height
}

/** Handles in render order: positioned rows first, then layout-only rows. */
function getHandleOrder(node: Node): NodeHandle[] {
  return [
    ...node.handles.filter((h) => h.position !== HandlePosition.None),
    ...node.handles.filter((h) => h.position === HandlePosition.None),
  ]
}

/**
 * Local (node-space) Y of a handle's row center. Inline handles return the
 * center of their `HANDLE_ROW_HEIGHT` row; block handles return the center of
 * their label row, so the joint/label sit where an inline handle would at the
 * same stack position, with the block content extending below. Label-less,
 * position-less block handles have no label row, so their center is the
 * content row center.
 */
export function handleY(node: Node, handle: NodeHandle): number {
  if (node.collapsed) {
    // Every hidden handle docks at the header center — the y where edges to
    // a collapsed node's joints re-attach on its left/right edge.
    return LAYOUT.HEADER_HEIGHT / 2
  }
  const order = getHandleOrder(node)
  const rows = layoutRows(node)
  let y = LAYOUT.HEADER_HEIGHT
  for (let i = 0; i < order.length; i++) {
    const h = order[i]
    const height = rows[i]!.row
    if (h === handle) {
      const factory = getHandleFactory(h.type)
      if (factory?.config?.layout === 'block') {
        return hasLabelRow(h)
          ? y + LAYOUT.HANDLE_ROW_HEIGHT / 2
          : y + height / 2
      }
      return y + height / 2
    }
    y += height
  }
  return y
}
