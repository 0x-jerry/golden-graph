import type { INodeDefinition } from '../../../src/backend'
import { displayDefinition } from './Display'
import { imageLoaderDefinition } from './images/ImageLoader'
import { mathDefinitions } from './math'
import { numberDefinition } from './Number'
import { textDefinition } from './Text'
import { toStringDefinition } from './ToString'

export const nodeDefinitions: INodeDefinition[] = [
  ...mathDefinitions,
  numberDefinition,
  textDefinition,
  toStringDefinition,
  displayDefinition,
  imageLoaderDefinition,
]
