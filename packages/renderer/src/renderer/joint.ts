import Konva from 'konva'
import type { NodeHandle } from '@0x-jerry/golden-graph'
import { LAYOUT } from './constants'
import { getHandleFactory } from './handles'
import { DEFAULT_THEME } from '../theme'
import type { GraphTheme } from '../theme'
import type { HandleJointShape, IHandleJointStyle } from './handles/types'

/**
 * Joint style for a handle: a handle type's registered `config.joint` wins,
 * else the theme's `jointDefault` colour and `jointShape`.
 */
export function resolveJointStyle(
  handle: NodeHandle,
  theme: GraphTheme = DEFAULT_THEME,
): IHandleJointStyle {
  return (
    getHandleFactory(handle.type)?.config?.joint ?? {
      color: theme.colors.jointDefault,
      shape: theme.metrics.jointShape,
    }
  )
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
 *
 * The style is carried on the shape and read on every draw, so a theme
 * hot-swap only has to replace it (see {@link setJointStyle}) — no rebuild.
 */
export function createJointShape(style: IHandleJointStyle): Konva.Shape {
  const radius = LAYOUT.JOINT_RADIUS
  const shape = new Konva.Shape({
    width: radius * 2,
    height: radius * 2,
    sceneFunc: (context, s) => {
      context.beginPath()
      drawJointPath(context, carrier(s).jointStyle.shape, radius)
      context.closePath()
      context.fillStrokeShape(s)
    },
  }) as JointShapeCarrier
  shape.jointStyle = style
  shape._centroid = true
  return shape
}

/**
 * Replace a joint's style. The style is a plain property read by the scene
 * func, so Konva is not notified of the change — this marks the layer dirty
 * rather than relying on the following fill/stroke setters firing an event
 * (they no-op when a theme only changes the joint shape).
 */
export function setJointStyle(
  shape: Konva.Shape,
  style: IHandleJointStyle,
): void {
  carrier(shape).jointStyle = style
  shape.getLayer()?.batchDraw()
}

interface JointShapeCarrier extends Konva.Shape {
  jointStyle: IHandleJointStyle
  _centroid: boolean
}

function carrier(shape: Konva.Shape): JointShapeCarrier {
  return shape as JointShapeCarrier
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
