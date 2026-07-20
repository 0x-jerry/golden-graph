import Konva from 'konva'
import type { HandleModule } from './types'

export const type = 'default'

// The handle name is rendered by HandleRenderer itself (next to the joint
// dot), so the default module renders no extra content.
export const create: HandleModule['create'] = () => {
  return new Konva.Group()
}
