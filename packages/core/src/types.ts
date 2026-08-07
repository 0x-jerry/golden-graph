import type { IVec2 } from '@0x-jerry/golden-graph-protocol'

export type ObjectAny = Record<string, any>

export interface IDisposable {
  dispose(): void
}

export type IDisposableFn = () => void

export interface IRenderer {
  getNodesBounding(nodeIds: number[]): {
    x: number
    y: number
    width: number
    height: number
  }

  /**
   * Center of the viewport in stage (screen) coordinates.
   * Used to anchor zoom operations.
   */
  getViewportCenter?(): IVec2
}
