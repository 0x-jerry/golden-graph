import { sleep } from '@0x-jerry/utils'
import { isEqual } from 'lodash-es'
import { HandlePosition } from './HandlePosition'
import { toReadonly } from './helper'
import type { Node } from './Node'
import type { Workspace } from './Workspace'

export class Executor {
  constructor(readonly ws: Workspace) {}

  _processStack: Node[] = []
  _processed = new Set<Node>()

  _cache = new Map<number, Record<string, unknown>>()
  _cacheNew = new Map<number, Record<string, unknown>>()

  _state = {
    isProcessing: false,
    currentNodeId: 0,
  }

  get state() {
    return toReadonly(this._state)
  }

  async execute(entryNodes: Node[]) {
    if (this._state.isProcessing) {
      console.warn('Executor is running')
      return
    }

    try {
      this._state.isProcessing = true
      this._state.currentNodeId = -1
      this.ws.events.emit('executor:changed', this._state)

      await this._execute(entryNodes)
      this._cache = this._cacheNew
      this._cacheNew = new Map()
    } catch (error) {
      // Drop partial results of the failed run so the next run diffs
      // against the last successful cache instead of stale entries.
      this._cacheNew = new Map()
      throw new Error(String(error), { cause: error })
    } finally {
      this._state.isProcessing = false
      this._state.currentNodeId = -1
      this.ws.events.emit('executor:changed', this._state)
    }
  }

  async _execute(entryNodes: Node[]) {
    // Use the array as a stack (push/pop are O(1), unlike shift/unshift).
    this._processStack = [...entryNodes].reverse()
    this._processed.clear()

    let i = 100_000

    while (this._processStack.length) {
      const currentNode = this._processStack.pop()!

      if (this._processed.has(currentNode)) {
        continue
      }

      await this._process(currentNode)

      if (!--i) {
        throw new Error('May encountered infinity loop!')
      }
    }
  }

  async _process(node: Node) {
    const inputs = node.queryHandles(HandlePosition.Left)

    const preprocessNodes: Node[] = []

    for (const inputHandle of inputs) {
      const connectedEdges = this.ws.queryEdges(inputHandle.loc)

      for (const edge of connectedEdges) {
        const otherHandle = edge.start === inputHandle ? edge.end : edge.start
        const connectedNode = otherHandle.node

        if (this._processed.has(connectedNode)) {
          continue
        }

        preprocessNodes.push(connectedNode)
      }
    }

    if (preprocessNodes.length) {
      // Re-queue the current node and process its dependencies first.
      this._processStack.push(node)
      for (let idx = preprocessNodes.length - 1; idx >= 0; idx--) {
        this._processStack.push(preprocessNodes[idx]!)
      }

      return
    }

    this._state.currentNodeId = node.id
    this.ws.events.emit('executor:changed', this._state)

    const prevData = this._cache.get(node.id)
    const currentData = node.getAllData()
    const isTheSameData = isEqual(currentData, prevData)

    if (!isTheSameData) {
      if (this.ws.state.debug) {
        await sleep(100)
      }

      await node.onProcess?.(node)
    }

    this._cacheNew.set(node.id, node.getAllData())

    this._processed.add(node)

    const outputs = node.queryHandles(HandlePosition.Right)

    const nextProcessNodes: Node[] = []

    for (const outputHandle of outputs) {
      const connectedEdges = this.ws.queryEdges(outputHandle.loc)

      for (const edge of connectedEdges) {
        const otherHandle = edge.start === outputHandle ? edge.end : edge.start
        const connectedNode = otherHandle.node

        nextProcessNodes.push(connectedNode)
      }
    }

    for (let idx = nextProcessNodes.length - 1; idx >= 0; idx--) {
      this._processStack.push(nextProcessNodes[idx]!)
    }
  }
}
