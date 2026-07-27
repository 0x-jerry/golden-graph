import { describe, expect, it } from 'vitest'
import { HandlePosition, NodeType, Workspace } from '../../src/core'
import type { INodeDefinition } from '../../src/backend'
import { DirectExecutorBackend } from '../helpers/DirectExecutorBackend'

const calls: string[] = []

const sourceDefinition: INodeDefinition = {
  schema: {
    type: 'Source',
    name: 'Source',
    nodeType: NodeType.Entry,
    handles: [
      { key: 'out', position: HandlePosition.Right, type: 'number', value: 1 },
    ],
  },
  execute: () => {
    calls.push('Source')
  },
}

function createWs(definitions: INodeDefinition[] = [sourceDefinition]) {
  const ws = new Workspace({
    executorBackend: new DirectExecutorBackend(definitions),
  })
  for (const def of definitions) {
    ws.registerNodeSchema(def.schema)
  }
  return ws
}

describe('Executor (frontend facade)', () => {
  it('throws when no executor backend is configured', async () => {
    const ws = new Workspace()

    await expect(ws.execute()).rejects.toThrow(/no executor backend/)
  })

  it('throws when loading node schemas without a backend', async () => {
    const ws = new Workspace()

    await expect(ws.loadNodeSchemasFromBackend()).rejects.toThrow(
      /no executor backend/,
    )
  })

  it('ignores re-entrant execute calls while processing', async () => {
    calls.length = 0
    const ws = createWs()
    ws.addNode('Source')

    // debug mode paces execution, so the first run is still in flight
    // when the second execute() call happens.
    ws.setDebug(true)

    const first = ws.execute()
    const second = ws.execute()

    await Promise.all([first, second])

    expect(calls).toEqual(['Source'])
  })
})
