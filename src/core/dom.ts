import type { Optional } from '@0x-jerry/utils'

export function getWorkspaceDom(workspaceId: string) {
  return document.querySelector(
    `[workspace-id="${workspaceId}"]`,
  ) as Optional<HTMLElement>
}

export function getNodeDom(workspaceId: string, nodeId: number) {
  return getWorkspaceDom(workspaceId)?.querySelector(
    `[node-id="${nodeId}"]`,
  ) as Optional<HTMLElement>
}

export function getNodeHandleDom(
  workspaceId: string,
  nodeId: number,
  handleKey: string,
) {
  return getNodeDom(workspaceId, nodeId)?.querySelector(
    `[handle-key="${handleKey}"]`,
  ) as Optional<HTMLElement>
}
