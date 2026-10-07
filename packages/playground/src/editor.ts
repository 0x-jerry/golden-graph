import type { Node, Workspace } from '@0x-jerry/golden-graph'
import { WorkerExecutorBackend } from '@0x-jerry/golden-graph-backend'
import { autoLayout } from '@0x-jerry/golden-graph-renderer'
import { TSL_OUTPUT_NODE_TYPE } from './nodes/tsl'

export async function setup(workspace: Workspace) {
  const worker = new Worker(new URL('./executor.worker.ts', import.meta.url), {
    type: 'module',
  })
  workspace.setExecutorBackend(new WorkerExecutorBackend(worker))

  await workspace.loadNodeProvidersFromBackend()

  // A flowing nebula: fractal noise + a radial term drive a cosine palette.
  const uv = workspace.addNode('TSL.Input.UvCentered')
  const scale = workspace.addNode('TSL.Input.Float', { data: { out: 1.2 } })
  const frequency = workspace.addNode('TSL.Math.Multiply')
  const time = workspace.addNode('TSL.Input.Time')
  const speed = workspace.addNode('TSL.Input.Float', { data: { out: 0.12 } })
  const flow = workspace.addNode('TSL.Math.Multiply')
  const noise = workspace.addNode('TSL.Procedural.Noise', {
    data: { octaves: '2' },
  })
  const contrast = workspace.addNode('TSL.Input.Float', { data: { out: 0.55 } })
  const field = workspace.addNode('TSL.Math.Multiply')
  const radius = workspace.addNode('TSL.Vector.Length')
  const falloff = workspace.addNode('TSL.Input.Float', { data: { out: 0.35 } })
  const radial = workspace.addNode('TSL.Math.Multiply')
  const coordinate = workspace.addNode('TSL.Math.Add')
  const palette = workspace.addNode('TSL.Color.Palette', {
    data: { a: '#16162e', b: '#9999b3', c: '#ffffff', d: '#0055aa' },
  })
  const output = workspace.addNode(TSL_OUTPUT_NODE_TYPE)

  connect(workspace, uv, 'out', frequency, 'a')
  connect(workspace, scale, 'out', frequency, 'b')
  connect(workspace, time, 'out', flow, 'a')
  connect(workspace, speed, 'out', flow, 'b')
  connect(workspace, frequency, 'out', noise, 'p')
  connect(workspace, flow, 'out', noise, 'z')
  connect(workspace, noise, 'out', field, 'a')
  connect(workspace, contrast, 'out', field, 'b')
  connect(workspace, uv, 'out', radius, 'v')
  connect(workspace, radius, 'out', radial, 'a')
  connect(workspace, falloff, 'out', radial, 'b')
  connect(workspace, field, 'out', coordinate, 'a')
  connect(workspace, radial, 'out', coordinate, 'b')
  connect(workspace, coordinate, 'out', palette, 't')
  connect(workspace, palette, 'out', output, 'input')

  workspace.addGroup([
    uv.id,
    scale.id,
    time.id,
    speed.id,
    contrast.id,
    falloff.id,
  ])
  workspace.groups[workspace.groups.length - 1]?.setName('Controls')

  const { rect } = autoLayout(workspace)
  fitView(workspace, rect)

  return workspace
}

function connect(
  workspace: Workspace,
  from: Node,
  fromKey: string,
  to: Node,
  toKey: string,
) {
  workspace.connect(from.getHandle(fromKey)!, to.getHandle(toKey)!)
}

/**
 * `autoLayout` centers the graph on the viewport center, so zooming about that
 * same point keeps it centered. The viewport size is twice its center — the
 * stage origin is the top-left corner.
 */
function fitView(workspace: Workspace, rect: { width: number; height: number }) {
  const center = workspace.renderer?.getViewportCenter?.()

  if (!center || !rect.width || !rect.height) {
    return
  }

  const width = (center.x * 2 - 96) / rect.width
  const height = (center.y * 2 - 96) / rect.height
  const fit = Math.min(1, Math.min(width, height))

  workspace.coord.zoomAt(center, Math.max(0.5, fit))
}
