import { RRenderer } from '@0x-jerry/golden-graph/src'

export function setup(rootEl: HTMLElement) {
  const renderer = new RRenderer({ x: 800, y: 600 })

  renderer.mount(rootEl)
}
