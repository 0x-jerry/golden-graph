/**
 * Scene and shape vocabulary shared by the preview and the example graphs.
 * The active scene is what decides where a `TSL.Output` source lands, so this
 * is also the key the graph examples are looked up by.
 */

export type SceneId = 'material' | 'pipeline'

export interface SceneMeta {
  id: SceneId
  label: string
}

export const SCENES: SceneMeta[] = [
  { id: 'material', label: 'Material preview' },
  { id: 'pipeline', label: 'Render pipeline' },
]

export const DEFAULT_SCENE_ID: SceneId = 'material'

export function readSceneId(value: unknown): SceneId {
  return value === 'pipeline' ? 'pipeline' : DEFAULT_SCENE_ID
}

export type PreviewShape = 'plane' | 'sphere' | 'torus'

export const SHAPES: { value: PreviewShape; label: string }[] = [
  { value: 'plane', label: 'Plane' },
  { value: 'sphere', label: 'Sphere' },
  { value: 'torus', label: 'Torus knot' },
]

export const DEFAULT_SHAPE: PreviewShape = 'plane'
