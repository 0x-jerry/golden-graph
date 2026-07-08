import type { Workspace } from '../../../src'
import { DisplayNode } from './Display'
import { ImageLoaderNode } from './images/ImageLoader'
import { registerMathNodes } from './math'
import { NumberNode } from './Number'
import { ToStringNode } from './ToString'

export function registerNodes(workspace: Workspace) {
  registerMathNodes(workspace)

  workspace.registerNode('Number', NumberNode)
  workspace.registerNode('ToString', ToStringNode)
  workspace.registerNode('Output', DisplayNode)
  workspace.registerNode('ImageLoader', ImageLoaderNode)
}
