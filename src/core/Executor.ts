import { isEqual } from 'lodash-es'
import { reactive } from 'vue'
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

  _state = reactive({
    isProcessing: false,
    currentNodeId: 0,
  })

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

      await this._execute(entryNodes)
      this._cache = this._cacheNew
      this._cacheNew = new Map()
    } catch (error) {
      throw new Error(String(error), { cause: error })
    } finally {
      this._state.isProcessing = false
      this._state.currentNodeId = -1
    }
  }

  async _execute(entryNodes: Node[]) {
    this._processStack = [...entryNodes]
    this._processed.clear()

    let i = 10_0000

    while (this._processStack.length) {
      const currentNode = this._processStack.shift()!

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
      this._processStack.unshift(...preprocessNodes, node)

      return
    }

    this._state.currentNodeId = node.id

    const prevData = this._cache.get(node.id)
    const currentData = node.getAllData()
    const isTheSameData = isEqual(currentData, prevData)

    if (!isTheSameData) {
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

    this._processStack.unshift(...nextProcessNodes)
  }
}
