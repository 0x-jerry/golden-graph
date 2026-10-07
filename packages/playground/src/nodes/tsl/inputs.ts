import { HandlePosition, NodeType } from '@0x-jerry/golden-graph'
import type { INodeHandleConfig } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'

/** Entry node whose single output handle already holds the TSL source. */
function sourceNode(
  name: string,
  description: string,
  handle: INodeHandleConfig,
): INodeDefinition {
  return {
    schema: {
      name,
      description,
      nodeType: NodeType.Entry,
      handles: [handle],
    },
  }
}

export const timeDefinition = sourceNode(
  'Time',
  'time — elapsed seconds, animated by the renderer',
  {
    key: 'out',
    name: 'Time',
    position: HandlePosition.Right,
    accepts: 'float',
    value: 'time',
  },
)

export const uvDefinition = sourceNode('UV', 'uv() — surface UV coordinates', {
  key: 'out',
  name: 'UV',
  position: HandlePosition.Right,
  accepts: 'vec2',
  value: 'uv()',
})

export const uvCenteredDefinition = sourceNode(
  'UV (centered)',
  'uv() * 2 - 1 — UV centred on the origin, -1..1 on both axes',
  {
    key: 'out',
    name: 'UV',
    position: HandlePosition.Right,
    accepts: 'vec2',
    value: 'sub(mul(uv(), 2.0), 1.0)',
  },
)

export const positionDefinition = sourceNode(
  'Position',
  'positionLocal — vertex position in object space',
  {
    key: 'out',
    name: 'Position',
    position: HandlePosition.Right,
    accepts: 'vec3',
    value: 'positionLocal',
  },
)

export const normalDefinition = sourceNode(
  'Normal',
  'normalWorld — world-space surface normal',
  {
    key: 'out',
    name: 'Normal',
    position: HandlePosition.Right,
    accepts: 'vec3',
    value: 'normalWorld',
  },
)

export const floatDefinition = sourceNode(
  'Float',
  'A constant float you can edit',
  {
    key: 'out',
    name: 'Value',
    position: HandlePosition.Right,
    type: 'number',
    accepts: 'float',
    value: 1,
    options: { step: 0.01 },
  },
)

export const colorDefinition = sourceNode(
  'Color',
  'A constant color, emitted as linear vec3',
  {
    key: 'out',
    name: 'Color',
    position: HandlePosition.Right,
    type: 'color',
    accepts: 'vec3',
    value: '#6366f1',
  },
)

/**
 * The scene rendered to a texture node. Pipeline effects compose onto this —
 * without a pass there is no frame for `Render pipeline · Output` to post
 * process. `scene` and `camera` are provided to the TSL compiler as extra
 * scope by the preview.
 */
export const scenePassDefinition = sourceNode(
  'Scene Pass',
  'pass(scene, camera) — the rendered frame, for render pipeline effects',
  {
    key: 'out',
    name: 'Frame',
    position: HandlePosition.Right,
    accepts: 'vec4',
    value: 'pass(scene, camera)',
  },
)
