import type { Workspace } from '../../../../src'
import { MathOpNode } from './Op'

export function registerMathNodes(workspace: Workspace) {
  workspace.registerNode('Math.Op', MathOpNode)
}
