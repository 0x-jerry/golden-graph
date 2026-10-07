import type { Workspace } from '@0x-jerry/golden-graph'
import { WorkerExecutorBackend } from '@0x-jerry/golden-graph-backend'
import { buildSceneExample } from './examples'
import { DEFAULT_SCENE_ID } from './preview/scene-meta'

export async function setup(workspace: Workspace) {
  const worker = new Worker(new URL('./executor.worker.ts', import.meta.url), {
    type: 'module',
  })
  workspace.setExecutorBackend(new WorkerExecutorBackend(worker))

  await workspace.loadNodeProvidersFromBackend()

  // The preview starts on the same scene, so the graph and the scene agree.
  buildSceneExample(workspace, DEFAULT_SCENE_ID)

  return workspace
}
