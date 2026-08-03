import type { Disposable, Workspace } from '@0x-jerry/golden-graph'
import type { EntityViewStore } from './EntityViewStore'
import type { GraphStateSyncer } from './GraphStateSyncer'

/**
 * Maps workspace events to store mutations / state syncs. All unsubscriptions
 * are registered into `target`.
 */
export function subscribeGraphEvents(
  ws: Workspace,
  store: EntityViewStore,
  syncer: GraphStateSyncer,
  target: Disposable,
) {
  target.add(
    ws.events.on('node:added', (node) => {
      store.addNode(node)
      // Only edges connected to the new node can be affected (e.g. an edge
      // whose line was skipped earlier because the node did not exist yet).
      store.rebuildEdgesForNode(node.id)
      store.redrawEdges()
    }),
  )

  target.add(
    ws.events.on('node:removed', (node) => {
      store.removeNode(node)
      store.redrawNodes()
    }),
  )

  target.add(
    ws.events.on('node:changed', (node) => {
      store.updateNode(node)
      store.rebuildEdgesForNode(node.id)
      store.redrawNodes()
      store.redrawEdges()
    }),
  )

  target.add(
    ws.events.on('edge:added', (edge) => {
      store.addEdgeLine(edge)
      store.redrawEdges()
    }),
  )

  target.add(
    ws.events.on('edge:removed', (edge) => {
      store.removeEdge(edge)
      store.redrawEdges()
    }),
  )

  target.add(
    ws.events.on('group:added', (group) => {
      store.addGroup(group)
      store.redrawGroups()
    }),
  )

  target.add(
    ws.events.on('group:removed', (group) => {
      store.removeGroup(group)
      store.redrawGroups()
    }),
  )

  target.add(
    ws.events.on('group:changed', (group) => {
      store.updateGroup(group)
      store.redrawGroups()
    }),
  )

  target.add(
    ws.events.on('coord:changed', () => {
      syncer.syncCoord()
    }),
  )

  target.add(
    ws.events.on('state:changed', () => {
      syncer.syncState()
    }),
  )

  target.add(
    ws.events.on('executor:changed', () => {
      syncer.syncExecutor()
    }),
  )

  target.add(
    ws.events.on('handle:updated', (handle) => {
      syncer.onHandleUpdated(handle)
    }),
  )

  target.add(
    ws.events.on('handle:connection-changed', (handle) => {
      syncer.onHandleConnectionChanged(handle)
      store.rebuildEdgesForNode(handle.node.id)
      store.redrawEdges()
    }),
  )
}
