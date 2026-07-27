import type { GroupConfig } from 'konva/lib/Group'

export const DEFAULT_HEIGHT = 24
export const DEFAULT_FONT_SIZE = 12
export const DEFAULT_FONT_FAMILY = 'Arial, sans-serif'
export const PADDING = 4

export interface BaseFormConfig extends GroupConfig {
  fontSize?: number
  fontFamily?: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  cornerRadius?: number
}

let measureCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null

function getMeasureCtx(): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
  if (!measureCtx) {
    if (typeof OffscreenCanvas !== 'undefined') {
      measureCtx = new OffscreenCanvas(0, 0).getContext('2d')!
    } else {
      measureCtx = document.createElement('canvas').getContext('2d')!
    }
  }
  return measureCtx
}

export function measureTextWidth(text: string, fontSize: number, fontFamily: string): number {
  const ctx = getMeasureCtx()
  ctx.font = `${fontSize}px ${fontFamily}`
  return ctx.measureText(text).width
}
