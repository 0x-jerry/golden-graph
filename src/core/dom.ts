export function getWorkspaceDom(workspaceId: string) {
  return document.querySelector(`[workspace-id="${workspaceId}"]`) as HTMLElement | null | undefined;
}

export function getNodeDom(workspaceId: string, nodeId: number) {
  return getWorkspaceDom(workspaceId)?.querySelector(
    `[node-id="${nodeId}"]`
  ) as HTMLElement | null | undefined;
}

export function getNodeHandleDom(
  workspaceId: string,
  nodeId: number,
  handleKey: string
) {
  return getNodeDom(workspaceId, nodeId)?.querySelector(
    `[handle-key="${handleKey}"]`
  ) as HTMLElement | null | undefined;
}
