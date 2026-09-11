import { WorkerExecutorBackend } from '@0x-jerry/golden-graph-backend'
import type { Workspace } from '@0x-jerry/golden-graph'

export async function setup(workspace: Workspace) {
  const worker = new Worker(
    new URL('./executor.worker.ts', import.meta.url),
    { type: 'module' },
  )
  workspace.setExecutorBackend(new WorkerExecutorBackend(worker))

  await workspace.loadNodeProvidersFromBackend()

  const n1 = workspace.addNode('Number', {
    pos: {
      x: 100,
      y: 100,
    },
  })

  workspace.addNode('Text', {
    pos: {
      x: 400,
      y: 100,
    },
  })

  const n2 = workspace.addNode('ToString', {
    pos: {
      x: 200,
      y: 200,
    },
  })

  workspace.addNode('Math.Op', {
    pos: {
      x: 200,
      y: 500,
    },
  })

  workspace.addNode('Output', {
    pos: {
      x: 500,
      y: 500,
    },
  })
  workspace.addNode('Output', {
    pos: {
      x: 500,
      y: 200,
    },
  })

  workspace.addNode('ImageLoader', {
    pos: {
      x: 500,
      y: 350,
    },
  })

  workspace.connect(n1.getHandle('output')!, n2.getHandle('input')!)

  // Style fixtures: a group (group chrome), a collapsed node (header-only
  // silhouette) and a subgraph node (the Composite tag).
  const grouped = workspace.addNode('Number', { pos: { x: 800, y: 100 } })
  const grouped2 = workspace.addNode('Text', { pos: { x: 1050, y: 100 } })
  workspace.addGroup([grouped.id, grouped2.id])

  const collapsed = workspace.addNode('Number', { pos: { x: 800, y: 300 } })
  collapsed.setCollapsed(true)

  const subA = workspace.addNode('Number', { pos: { x: 800, y: 480 } })
  const subB = workspace.addNode('Text', { pos: { x: 1050, y: 480 } })
  workspace.addGroup([subA.id, subB.id])
  const groups = workspace.groups
  workspace.convertGroupToSubGraph(groups[groups.length - 1]!.id)

  return workspace
}
