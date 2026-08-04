import { remove } from '@0x-jerry/utils'
import { convertGroupToSubGraph } from '../GroupToSubGraph'
import type { SubGraph } from '../SubGraph'
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
 * Sub-graph CRUD, navigation (enter/exit) and group → sub-graph conversion.
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

    // remove old sub graph node and rebuild new sub graph node

    const oldSubGraphNode = this.ws.nodes.find(
      (n) => n.subGraphId === subGraph.id,
    )
    if (!oldSubGraphNode) {
      throw new Error(`Can not find sub graph node by id ${subGraph.id}`)
    }

    const newSubGraphNode = subGraph.buildNode()
    newSubGraphNode.setWorkspace(this.ws)
    newSubGraphNode.fromJSON({
      ...oldSubGraphNode.toJSON(),
      data: {},
    })

    const edges = this.ws.queryConnectedEdges(oldSubGraphNode.id)

    const connections = edges.map((edge) => {
      const isStart = edge.start.node.id === oldSubGraphNode.id
      const myHandle = isStart ? edge.start : edge.end
      const otherHandle = isStart ? edge.end : edge.start

      const isOtherOnOldNode = otherHandle.node.id === oldSubGraphNode.id

      return {
        myHandleKey: myHandle.key,
        otherHandle,
        otherHandleKey: otherHandle.key,
        isOtherOnOldNode,
      }
    })

    this.ws.removeNodeByIds(oldSubGraphNode.id)
    this.ws.addRawNode(newSubGraphNode)

    for (const conn of connections) {
      const newHandle = newSubGraphNode.getHandle(conn.myHandleKey)

      const targetHandle = conn.isOtherOnOldNode
        ? newSubGraphNode.getHandle(conn.otherHandleKey)
        : conn.otherHandle

      if (newHandle && targetHandle) {
        this.ws.connect(targetHandle, newHandle)
      }
    }
  }

  copySubGraphNode(subGraphId: number) {
    const subGraph = this.ws._subGraphs.find((n) => n.id === subGraphId)

    if (!subGraph) {
      throw new Error(`Can not find subGraph by id ${subGraphId}`)
    }

    const node = subGraph.buildNode()

    this.ws.addRawNode(node)

    return node
  }
}
