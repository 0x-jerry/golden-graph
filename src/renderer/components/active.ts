import {
  ActiveElementManager,
  type IActiveElement,
} from '../ActiveElementManager'

export function setActiveElement(node: IActiveElement): void {
  const activeElementManager = node
    .getStage()
    ?.getAttr(ActiveElementManager.key) as ActiveElementManager | null
  activeElementManager?.set(node)
}
