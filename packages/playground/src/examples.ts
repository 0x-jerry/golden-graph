import type { Node, Workspace } from '@0x-jerry/golden-graph'
import { autoLayout } from '@0x-jerry/golden-graph-renderer'
import { TSL_OUTPUT_NODE_TYPE } from './nodes/tsl'
import type { SceneId } from './preview/scene-meta'

type ExampleBuilder = (ws: Workspace) => void

const EXAMPLES: Record<SceneId, ExampleBuilder> = {
  material: buildMaterialExample,
  pipeline: buildPipelineExample,
}

/**
 * Fill the (already cleared) workspace with the default graph for `sceneId`.
 * The active preview scene picks where that graph's Output lands, so each
 * scene ships the example that makes sense for it.
 */
export function buildSceneExample(ws: Workspace, sceneId: SceneId) {
  EXAMPLES[sceneId](ws)

  const { rect } = autoLayout(ws)
  fitView(ws, rect)
}

/** A flowing nebula: fractal noise + a radial term drive a cosine palette. */
function buildMaterialExample(ws: Workspace) {
  const uv = ws.addNode('TSL.Input.UvCentered')
  const scale = ws.addNode('TSL.Input.Float', { data: { out: 1.2 } })
  const frequency = ws.addNode('TSL.Math.Multiply')
  const time = ws.addNode('TSL.Input.Time')
  const speed = ws.addNode('TSL.Input.Float', { data: { out: 0.12 } })
  const flow = ws.addNode('TSL.Math.Multiply')
  const noise = ws.addNode('TSL.Procedural.Noise', {
    data: { octaves: '2' },
  })
  const contrast = ws.addNode('TSL.Input.Float', { data: { out: 0.55 } })
  const field = ws.addNode('TSL.Math.Multiply')
  const radius = ws.addNode('TSL.Vector.Length')
  const falloff = ws.addNode('TSL.Input.Float', { data: { out: 0.35 } })
  const radial = ws.addNode('TSL.Math.Multiply')
  const coordinate = ws.addNode('TSL.Math.Add')
  const palette = ws.addNode('TSL.Color.Palette', {
    data: { a: '#16162e', b: '#9999b3', c: '#ffffff', d: '#0055aa' },
  })
  const output = ws.addNode(TSL_OUTPUT_NODE_TYPE)

  connect(ws, uv, 'out', frequency, 'a')
  connect(ws, scale, 'out', frequency, 'b')
  connect(ws, time, 'out', flow, 'a')
  connect(ws, speed, 'out', flow, 'b')
  connect(ws, frequency, 'out', noise, 'p')
  connect(ws, flow, 'out', noise, 'z')
  connect(ws, noise, 'out', field, 'a')
  connect(ws, contrast, 'out', field, 'b')
  connect(ws, uv, 'out', radius, 'v')
  connect(ws, radius, 'out', radial, 'a')
  connect(ws, falloff, 'out', radial, 'b')
  connect(ws, field, 'out', coordinate, 'a')
  connect(ws, radial, 'out', coordinate, 'b')
  connect(ws, coordinate, 'out', palette, 't')
  connect(ws, palette, 'out', output, 'input')

  ws.addGroup([
    uv.id,
    scale.id,
    time.id,
    speed.id,
    contrast.id,
    falloff.id,
  ])
  ws.groups[ws.groups.length - 1]?.setName('Controls')
}

/**
 * Full-frame grade for the render pipeline: the scene pass tinted from a warm
 * centre to a cool rim by the centred-UV radius.
 */
function buildPipelineExample(ws: Workspace) {
  const frame = ws.addNode('TSL.Input.ScenePass')
  const rgb = ws.addNode('TSL.Vector.Swizzle', { data: { component: 'rgb' } })
  const uv = ws.addNode('TSL.Input.UvCentered')
  const radius = ws.addNode('TSL.Vector.Length')
  const falloff = ws.addNode('TSL.Color.Smoothstep', {
    data: { e0: 1.35, e1: 0.25 },
  })
  const rim = ws.addNode('TSL.Input.Color', { data: { out: '#3d4b7a' } })
  const centre = ws.addNode('TSL.Input.Color', { data: { out: '#fff3dd' } })
  const tint = ws.addNode('TSL.Color.Mix')
  const graded = ws.addNode('TSL.Math.Multiply')
  const output = ws.addNode(TSL_OUTPUT_NODE_TYPE)

  connect(ws, frame, 'out', rgb, 'in')
  connect(ws, uv, 'out', radius, 'v')
  connect(ws, radius, 'out', falloff, 'x')
  connect(ws, rim, 'out', tint, 'a')
  connect(ws, centre, 'out', tint, 'b')
  connect(ws, falloff, 'out', tint, 't')
  connect(ws, rgb, 'out', graded, 'a')
  connect(ws, tint, 'out', graded, 'b')
  connect(ws, graded, 'out', output, 'input')
}

function connect(
  ws: Workspace,
  from: Node,
  fromKey: string,
  to: Node,
  toKey: string,
) {
  ws.connect(from.getHandle(fromKey)!, to.getHandle(toKey)!)
}

/**
 * `autoLayout` centers the graph on the viewport center, so zooming about that
 * same point keeps it centered. The viewport size is twice its center — the
 * stage origin is the top-left corner.
 */
function fitView(ws: Workspace, rect: { width: number; height: number }) {
  const center = ws.renderer?.getViewportCenter?.()

  if (!center || !rect.width || !rect.height) {
    return
  }

  const width = (center.x * 2 - 96) / rect.width
  const height = (center.y * 2 - 96) / rect.height
  const fit = Math.min(1, Math.min(width, height))

  ws.coord.zoomAt(center, Math.max(0.5, fit))
}
