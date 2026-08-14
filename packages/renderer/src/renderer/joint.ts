import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { COLORS, LAYOUT } from './constants'
import { getHandleFactory } from './handles'
import type { HandleJointShape, IHandleJointStyle } from './handles/types'

/**
 * Joint style used when a handle type has no registered joint config.
 */
export const DEFAULT_JOINT_STYLE: IHandleJointStyle = {
  color: COLORS.JOINT_DEFAULT,
  shape: 'circle',
}

/**
 * Resolve the joint style for a handle. A pure function of `handle.type`:
 * the registered factory's `config.joint`, else the default.
 */
export function resolveJointStyle(handle: NodeHandle): IHandleJointStyle {
  return getHandleFactory(handle.type)?.config?.joint ?? DEFAULT_JOINT_STYLE
}

/**
 * Joint color at an alpha (0..1). Hex colors are converted to `rgba(...)`;
 * non-hex colors are returned unchanged (alpha not applied).
 */
export function jointColor(style: IHandleJointStyle, alpha: number): string {
  return hexToRgba(style.color, alpha) ?? style.color
}

function hexToRgba(hex: string, alpha: number): string | null {
  let h = hex.trim().replace('#', '')
  if (h.length === 3 && /^[0-9a-f]{3}$/i.test(h)) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (!/^[0-9a-f]{6}$/i.test(h)) {
    return null
  }
  const n = parseInt(h, 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Create the Konva node drawing a joint. One `Konva.Shape` per style. The
 * shape's local origin is its center (no offset) — `_centroid` is set like
 * `Konva.Circle`, so `x`/`y` position the joint center exactly.
 */
export function createJointShape(style: IHandleJointStyle): Konva.Shape {
  const radius = LAYOUT.JOINT_RADIUS
  const shape = new Konva.Shape({
    width: radius * 2,
    height: radius * 2,
    sceneFunc: (context, s) => {
      context.beginPath()
      drawJointPath(context, style.shape, radius)
      context.closePath()
      context.fillStrokeShape(s)
    },
  })
  ;(shape as Konva.Shape & { _centroid: boolean })._centroid = true
  return shape
}

function drawJointPath(
  context: Konva.Context,
  shape: HandleJointShape,
  radius: number,
) {
  switch (shape) {
    case 'circle':
      context.arc(0, 0, radius, 0, Math.PI * 2)
      break
    case 'square':
      context.rect(-radius, -radius, radius * 2, radius * 2)
      break
    case 'diamond':
      context.moveTo(radius, 0)
      context.lineTo(0, radius)
      context.lineTo(-radius, 0)
      context.lineTo(0, -radius)
      break
    case 'triangle': {
      const half = radius * Math.sin(Math.PI / 3)
      const height = radius * Math.cos(Math.PI / 3)
      context.moveTo(0, -radius)
      context.lineTo(-half, height)
      context.lineTo(half, height)
      break
    }
  }
}
