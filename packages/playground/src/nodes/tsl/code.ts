export const TSL_NUMERIC = ['float', 'vec2', 'vec3', 'vec4']

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/**
 * Wires carry TSL source fragments. Numbers and `#rrggbb` colors are the raw
 * values the editor widgets write; anything else is already valid source.
 *
 * Colors are decoded to linear, matching the renderer's output color space —
 * except with `raw`, used by coefficients that are plain vectors rather than
 * colors sampled in sRGB (e.g. cosine-palette terms).
 */
export function toTslCode(value: unknown, raw = false): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '0.0'
  }

  if (typeof value === 'string') {
    if (!HEX_COLOR.test(value)) {
      return value
    }

    return hexToVec3(value, raw ? (channel) => channel : srgbToLinear)
  }

  return '0.0'
}

function hexToVec3(hex: string, transform: (value: number) => number): string {
  return `vec3(${parseHex(hex).map(transform).map(round).join(', ')})`
}

function parseHex(hex: string): number[] {
  const raw = hex.slice(1)
  const full = raw.length === 3 ? raw.replace(/./g, (char) => char + char) : raw
  const channels: number[] = []

  for (let i = 0; i < 6; i += 2) {
    channels.push(parseInt(full.slice(i, i + 2), 16) / 255)
  }

  return channels
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function round(value: number): number {
  return Number(value.toFixed(4))
}
