import { WorkerExecutorBackend } from '../../src/backend'
import type { Workspace } from '../../src/core'

export async function setup(workspace: Workspace) {
  const worker = new Worker(
    new URL('./executor.worker.ts', import.meta.url),
    { type: 'module' },
  )
  workspace.setExecutorBackend(new WorkerExecutorBackend(worker))

  await workspace.loadNodeSchemasFromBackend()

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

  workspace.connect(n1.getHandle('output')!, n2.getHandle('input')!)

  return workspace
}
