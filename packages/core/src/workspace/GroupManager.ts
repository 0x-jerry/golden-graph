import { remove } from '@0x-jerry/utils'
import { Group } from '../Group'
import type { Workspace } from './Workspace'

/**
 * Group CRUD. Mutates `ws._groups` in place and emits `group:added` /
 * `group:removed` events.
 */
export class GroupManager {
  constructor(readonly ws: Workspace) {}

  addGroup(nodeIds: number[]) {
    if (!nodeIds.length) {
      return
    }

    if (!this.ws._renderer) {
      throw new Error(
        'Renderer not set. Call workspace.setRenderer() before addGroup().',
      )
    }

    const rect = this.ws._renderer.getNodesBounding(nodeIds)

    if (
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height)
    ) {
      throw new Error(
        `Can not compute bounding box for nodes: [${nodeIds.join(', ')}]`,
      )
    }

    const padding = 40
    const headerHeight = 50

    const g = new Group()
    g.id = this.ws.nextId()

    g.setWorkspace(this.ws)
    g.setPos({
      x: rect.x - padding,
      y: rect.y - padding - headerHeight,
    })
    g.setSize({
      x: rect.width + padding * 2,
      y: rect.height + padding * 2 + headerHeight,
    })

    g.nodes.push(...nodeIds)

    this.ws._groups.push(g)
    this.ws.events.emit('group:added', g)
  }

  removeGroup(groupId: number) {
    const groups = remove(this.ws._groups, (g) => g.id === groupId)
    for (const g of groups) {
      this.ws.events.emit('group:removed', g)
    }
    return groups
  }
}
