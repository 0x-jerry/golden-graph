import { describe, expect, it } from 'vitest'
import { sleep } from '@0x-jerry/utils'
import {
  HandlePosition,
  JsonRpcErrorCode,
  NodeType,
  isCancelledError,
} from '@0x-jerry/golden-graph-protocol'
import { Workspace } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '../src'
import { DirectExecutorBackend } from './helpers/DirectExecutorBackend'

const calls: string[] = []

const sourceDefinition: INodeDefinition = {
  schema: {
    type: 'Source',
    name: 'Source',
    nodeType: NodeType.Entry,
    handles: [
      { key: 'out', position: HandlePosition.Right, accepts: 'number', value: 1 },
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

  it('throws when loading node providers without a backend', async () => {
    const ws = new Workspace()

    await expect(ws.loadNodeProvidersFromBackend()).rejects.toThrow(
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

  it('cancel() stops the run and the execute promise rejects with a CancelledError', async () => {
    calls.length = 0
    const ws = createWs()
    ws.addNode('Source')

    // debug mode paces execution, so the run is still in flight when the
    // user action arrives (inside the node's debug sleep).
    ws.setDebug(true)

    const run = ws.execute()
    await sleep(5)
    ws.cancel()

    // cancellation is a user action, surfaced as a distinct error for
    // callers that opt in via isCancelledError()
    const error = await run.then(
      () => null,
      (e: unknown) => e,
    )
    expect(isCancelledError(error)).toBe(true)
    expect((error as { code?: number })?.code).toBe(JsonRpcErrorCode.Cancelled)

    // the facade still resets its state so the UI unlocks
    expect(ws.executorState.isProcessing).toBe(false)
    expect(ws.executorState.currentNodeId).toBe(-1)
    expect(ws.disabled).toBe(false)
  })

  it('cancel() is a no-op when no run is in flight', async () => {
    calls.length = 0
    const ws = createWs()
    ws.addNode('Source')

    ws.cancel()

    await ws.execute()
    expect(calls).toEqual(['Source'])
  })
})
