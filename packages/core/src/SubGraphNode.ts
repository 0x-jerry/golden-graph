import { Node } from './Node'
import type { SubGraph } from './SubGraph'
import {
  isSubGraphInputNode,
  isSubGraphOutputNode,
  subGraphInputToHandleConfig,
  subGraphOutputToHandleConfig,
} from './SubGraphSchema'

/**
 * A special `Node` that references a `SubGraph`. Renders like a normal node
 * but carries the collapsed interface of the sub-graph; `subGraphId` points
 * at the referenced `SubGraph`, so entering it navigates into its workspace.
 *
 * Multiple `SubGraphNode`s may reference the same `SubGraph` (e.g. copies
 * made by `Workspace.copySubGraphNode`), sharing one inner workspace.
 */
export class SubGraphNode extends Node {
  static override nodeName = 'SubGraph'

  static override internal = true

  _subGraph?: SubGraph

  get subGraph() {
    return this._subGraph
  }

  override get subGraphId() {
    return this._subGraph?.id
  }

  constructor(subGraph: SubGraph) {
    super()

    this._subGraph = subGraph
  }

  /**
   * (Re)build this node's handles from the sub-graph's interface nodes.
   * Returns `this` so callers can treat it as the node to place.
   */
  buildNode(): this {
    const handles = this._subGraph!.workspace.nodes

    const inputs = handles.filter(isSubGraphInputNode)
    const outputs = handles.filter(isSubGraphOutputNode)

    this._handles = []

    for (const output of outputs) {
      this.addHandle(subGraphOutputToHandleConfig(output))
    }

    for (const input of inputs) {
      this.addHandle(subGraphInputToHandleConfig(input))
    }

    return this
  }
}
