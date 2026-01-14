import { sleep } from '@0x-jerry/utils'
import { reactive } from 'vue'
import { HandlePosition } from './HandlePosition'
import type { Node } from './Node'
import type { Workspace } from './Workspace'

export class Executor {
  constructor(readonly ws: Workspace) {}

  processStack: Node[] = []
  processed = new Set<Node>()

  _state = reactive({
    isProcessing: false,
    currentNodeId: 0,
  })

  get state() {
    return this._state
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
    } catch (error) {
      throw new Error(String(error), { cause: error })
    } finally {
      this._state.isProcessing = false
      this._state.currentNodeId = -1
    }
  }

  async _execute(entryNodes: Node[]) {
    this.processStack = [...entryNodes]
    this.processed.clear()

    let i = 10_0000

    while (this.processStack.length) {
      const currentNode = this.processStack.shift()!

      if (this.processed.has(currentNode)) {
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

        if (this.processed.has(connectedNode)) {
          continue
        }

        preprocessNodes.push(connectedNode)
      }
    }

    if (preprocessNodes.length) {
      this.processStack.unshift(...preprocessNodes, node)

      return
    }

    this._state.currentNodeId = node.id

    // for debug
    await sleep(100)
    await node.onProcess?.(node)

    this.processed.add(node)

    const outputs = node.queryHandles(HandlePosition.Right)

    const nextProcessNodes: Node[] = []

    for (const outputHandle of outputs) {
      const connectedEdges = this.ws.queryEdges(outputHandle.loc)

      for (const edge of connectedEdges) {
        const otherHandle = edge.start === outputHandle ? edge.end : edge.start
        const connectedNode = otherHandle.node

        otherHandle.setValue(outputHandle.getValue())

        nextProcessNodes.push(connectedNode)
      }
    }

    this.processStack.unshift(...nextProcessNodes)
  }
}
