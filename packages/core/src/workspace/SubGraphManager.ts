import { remove } from '@0x-jerry/utils'
import { convertGroupToSubGraph } from '../GroupToSubGraph'
import type { SubGraph } from '../SubGraph'
import type { SubGraphNode } from '../SubGraphNode'
import type { IWorkspace } from '../types'
import type { Workspace } from './Workspace'

/**
 * Snapshot of the parent workspace pushed by `enterSubGraph()`, used by
 * `exitSubGraph()` to restore it.
 */
export interface IWorkspaceData {
  subGraphId: number
  data: IWorkspace
}

/**
 * Sub-graph CRUD, navigation (enter/exit), group → sub-graph conversion and
 * sub-graph node copying.
 *
 * A `SubGraph` is a container (inner workspace + referencing `SubGraphNode`s),
 * while a `SubGraphNode` is a special `Node` that references a `SubGraph` via
 * `subGraphId`.
 *
 * Mutates `ws._subGraphs` / `ws._workspaceDataStack` in place and emits
 * `subgraph:added` / `subgraph:removed` events.
 */
export class SubGraphManager {
  constructor(readonly ws: Workspace) {}

  convertGroupToSubGraph(groupId: number) {
    const subGraph = convertGroupToSubGraph(this.ws, groupId)

    this.addSubGraph(subGraph)
  }

  addSubGraph(subGraph: SubGraph) {
    if (this.ws.subGraphs.find((g) => g.id === subGraph.id)) {
      throw new Error(`SubGraph [${subGraph.id}] is already added!`)
    }

    this.ws._subGraphs.push(subGraph)
    this.ws.events.emit('subgraph:added', subGraph)
  }

  removeSubGraph(subGraphId: number) {
    const removed = remove(this.ws._subGraphs, (g) => g.id === subGraphId)
    for (const s of removed) {
      this.ws.events.emit('subgraph:removed', s)
    }
    return removed
  }

  enterSubGraph(subGraphId: number) {
    const subGraph = this.ws.subGraphs.find((g) => g.id === subGraphId)
    if (!subGraph) {
      return
    }

    this.ws._workspaceDataStack.push({
      subGraphId: subGraphId,
      data: this.ws.toJSON(),
    })

    const data = subGraph.workspace.toJSON()
    this.ws.fromJSON(data)
  }

  exitSubGraph() {
    const prevData = this.ws._workspaceDataStack.pop()
    if (!prevData) {
      throw new Error('Current workspace is not a Sub Graph')
    }

    const subGraphWorkspaceData = this.ws.toJSON()

    this.ws.fromJSON(prevData.data)

    const subGraph = this.ws._subGraphs.find(
      (n) => n.id === prevData.subGraphId,
    )
    if (!subGraph) {
      throw new Error(`Can not find subGraph by id ${prevData.subGraphId}`)
    }

    subGraph.workspace.fromJSON(subGraphWorkspaceData)

    // Rebuild the existing SubGraphNode's handles in place and reconnect the
    // surviving external edges.
    const subGraphNode = this.ws.nodes.find(
      (n) => n.subGraphId === subGraph.id,
    ) as SubGraphNode | undefined
    if (!subGraphNode) {
      throw new Error(`Can not find sub graph node by id ${subGraph.id}`)
    }

    const edges = this.ws.queryConnectedEdges(subGraphNode.id)

    const connections = edges.map((edge) => {
      const isStart = edge.start.node.id === subGraphNode.id
      const myHandle = isStart ? edge.start : edge.end
      const otherHandle = isStart ? edge.end : edge.start

      const isOtherOnOldNode = otherHandle.node.id === subGraphNode.id

      return {
        myHandleKey: myHandle.key,
        otherHandle,
        otherHandleKey: otherHandle.key,
        isOtherOnOldNode,
      }
    })

    // Drop the old edges (and their handle back-references) before the handles
    // are rebuilt, then recreate the connections against the new handles.
    this.ws.removeEdgeByIds(...edges.map((e) => e.id))

    subGraphNode.buildNode()

    for (const conn of connections) {
      const newHandle = subGraphNode.getHandle(conn.myHandleKey)

      const targetHandle = conn.isOtherOnOldNode
        ? subGraphNode.getHandle(conn.otherHandleKey)
        : conn.otherHandle

      if (newHandle && targetHandle) {
        this.ws.connect(targetHandle, newHandle)
      }
    }
  }

  /**
   * Copy a sub-graph node. The copy references the same `SubGraph` (and thus
   * the same inner workspace) as the original.
   */
  copySubGraphNode(subGraphId: number) {
    const subGraph = this.ws._subGraphs.find((n) => n.id === subGraphId)

    if (!subGraph) {
      throw new Error(`Can not find subGraph by id ${subGraphId}`)
    }

    const source = this.ws.nodes.find((n) => n.subGraphId === subGraph.id) as
      | SubGraphNode
      | undefined

    const copy = subGraph.buildNode()
    if (source) {
      copy.name = source.name
      // Offset from the source node so the copy doesn't overlap it.
      copy.moveTo(source.pos.x + COPY_OFFSET, source.pos.y + COPY_OFFSET)
    }

    this.ws.addRawNode(copy)

    return copy
  }
}

const COPY_OFFSET = 30
