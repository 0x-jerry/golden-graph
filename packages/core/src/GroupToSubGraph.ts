import type { INodeHandleLoc } from '@0x-jerry/golden-graph-protocol'
import type { Edge } from './Edge'
import type { Node } from './Node'
import type { NodeHandle } from './NodeHandle'
import { SubGraph } from './SubGraph'
import type { Workspace } from './Workspace'

interface ExternalEdgeInfo {
  edge: Edge
  isStartIn: boolean
}

interface HandleConnectionInfo {
  type: 'input' | 'output'
  node: Node
  // List of internal handles that share this connection (merged inputs)
  handles: NodeHandle[]
  externalLocs: INodeHandleLoc[]
  interfaceNodeId?: number
}

interface ConversionContext {
  workspace: Workspace
  groupId: number
  groupNodes: Node[]
  internalEdges: Edge[]
  externalEdges: ExternalEdgeInfo[]
  handleMap: Map<string, HandleConnectionInfo>
  externalOutputToInternalInputMap: Map<string, string>
}

export function convertGroupToSubGraph(
  workspace: Workspace,
  groupId: number,
): SubGraph {
  const context: ConversionContext = {
    workspace,
    groupId,
    groupNodes: [],
    internalEdges: [],
    externalEdges: [],
    handleMap: new Map(),
    externalOutputToInternalInputMap: new Map(),
  }

  const group = validateAndGetGroup(context)
  const subGraph = createSubGraph(context)

  classifyElements(context, group.nodes)
  analyzeConnections(context)
  migrateContent(context, subGraph, group.nodes)
  createInterfaceNodes(context, subGraph)

  const subGraphNode = createSubGraphNode(context, subGraph, group.pos)
  context.workspace.addRawNode(subGraphNode)

  reconnectExternalEdges(context, subGraphNode)

  workspace.removeGroup(groupId)

  return subGraph
}

function validateAndGetGroup(ctx: ConversionContext) {
  const group = ctx.workspace.groups.find((g) => g.id === ctx.groupId)
  if (!group) {
    throw new Error(`Group [${ctx.groupId}] is not found!`)
  }
  return group
}

function createSubGraph(ctx: ConversionContext) {
  const subGraph = new SubGraph(ctx.workspace)
  subGraph.id = ctx.workspace.nextId()
  return subGraph
}

function classifyElements(ctx: ConversionContext, groupNodeIds: number[]) {
  ctx.groupNodes = ctx.workspace.queryNodes(...groupNodeIds)
  const allEdges = ctx.workspace.queryConnectedEdges(...groupNodeIds)

  for (const edge of allEdges) {
    const isStartIn = groupNodeIds.includes(edge.start.node.id)
    const isEndIn = groupNodeIds.includes(edge.end.node.id)

    if (isStartIn && isEndIn) {
      ctx.internalEdges.push(edge)
    } else {
      ctx.externalEdges.push({ edge, isStartIn })
    }
  }
}

function analyzeConnections(ctx: ConversionContext) {
  for (const { edge, isStartIn } of ctx.externalEdges) {
    const internalHandle = isStartIn ? edge.start : edge.end
    const externalHandle = isStartIn ? edge.end : edge.start

    const internalLoc = internalHandle.loc
    const externalLoc = externalHandle.loc

    const node = ctx.workspace.getNode(internalLoc.id)!
    const handle = node.getHandle(internalLoc.key)!

    const type = handle.isLeft ? 'input' : 'output'

    let mapKey = getMapKey(internalLoc.id, internalLoc.key)

    // Check if we can merge inputs
    if (type === 'input') {
      const externalId = getExternalHandleId(externalLoc)
      const existingInternalKey =
        ctx.externalOutputToInternalInputMap.get(externalId)

      if (existingInternalKey && ctx.handleMap.has(existingInternalKey)) {
        mapKey = existingInternalKey
      } else {
        ctx.externalOutputToInternalInputMap.set(externalId, mapKey)
      }
    }

    if (!ctx.handleMap.has(mapKey)) {
      ctx.handleMap.set(mapKey, {
        type,
        node,
        handles: [],
        externalLocs: [],
      })
    }

    const entry = ctx.handleMap.get(mapKey)!
    if (!entry.handles.includes(handle)) {
      entry.handles.push(handle)
    }
    if (
      !entry.externalLocs.some(
        (loc) => loc.id === externalLoc.id && loc.key === externalLoc.key,
      )
    ) {
      entry.externalLocs.push(externalLoc)
    }
  }
}

function migrateContent(
  ctx: ConversionContext,
  subGraph: SubGraph,
  groupNodeIds: number[],
) {
  // Remove from main workspace
  ctx.workspace.removeNodeByIds(...groupNodeIds)

  // Move to subgraph
  subGraph.addNodes(...ctx.groupNodes)
  subGraph.addEdges(...ctx.internalEdges)
}

function createInterfaceNodes(ctx: ConversionContext, subGraph: SubGraph) {
  const usedNames = new Set<string>()

  for (const item of ctx.handleMap.values()) {
    const firstHandle = item.handles[0]
    if (!firstHandle) continue
    let name = `${item.node.name}_${firstHandle.name}`

    if (usedNames.has(name)) {
      let i = 1
      while (usedNames.has(`${name}_${i}`)) {
        i++
      }
      name = `${name}_${i}`
    }
    usedNames.add(name)

    const type = firstHandle.accepts[0] || '*'

    if (item.type === 'input') {
      item.interfaceNodeId = createInputNode({
        subGraph,
        name,
        type,
        targetHandles: item.handles,
      })
    } else {
      item.interfaceNodeId = createOutputNode({
        subGraph,
        name,
        type,
        sourceHandles: item.handles,
      })
    }
  }
}

interface CreateInterfaceNodeOptions {
  subGraph: SubGraph
  name: string
  type: string
  targetHandles: NodeHandle[]
}

function createInputNode({
  subGraph,
  name,
  type,
  targetHandles,
}: CreateInterfaceNodeOptions) {
  const inputNode = subGraph.workspace.addNode('subgraph.input', {
    data: {
      Name: name,
      Type: type,
    },
  })
  const outputHandle = inputNode.getHandle('Output')!

  for (const handle of targetHandles) {
    subGraph.workspace.connect(outputHandle, handle)
  }

  return inputNode.id
}

function createOutputNode({
  subGraph,
  name,
  type,
  sourceHandles: targetHandles,
}: Omit<CreateInterfaceNodeOptions, 'targetHandles'> & {
  sourceHandles: NodeHandle[]
}) {
  const outputNode = subGraph.workspace.addNode('subgraph.output', {
    data: {
      Name: name,
      Type: type,
    },
  })
  const valueHandle = outputNode.getHandle('Value')!

  for (const handle of targetHandles) {
    subGraph.workspace.connect(handle, valueHandle)
  }

  return outputNode.id
}

function createSubGraphNode(
  ctx: ConversionContext,
  subGraph: SubGraph,
  pos: { x: number; y: number },
) {
  const subGraphNode = subGraph.buildNode()

  const group = validateAndGetGroup(ctx)
  subGraphNode.name = group.name
  subGraphNode.moveTo(pos.x, pos.y)

  return subGraphNode
}

function reconnectExternalEdges(ctx: ConversionContext, subGraphNode: Node) {
  for (const item of ctx.handleMap.values()) {
    const interfaceNodeId = item.interfaceNodeId
    if (interfaceNodeId == null) {
      continue
    }

    // Collapsed handles are keyed by the interface node id.
    const sgHandle = subGraphNode.getHandle(String(interfaceNodeId))

    if (!sgHandle) {
      console.warn(
        `Could not find handle [${interfaceNodeId}] on SubGraphNode`,
      )
      continue
    }

    for (const externalLoc of item.externalLocs) {
      const externalNode = ctx.workspace.getNode(externalLoc.id)
      if (!externalNode) continue
      const externalHandle = externalNode.getHandle(externalLoc.key)
      if (!externalHandle) continue

      if (item.type === 'input') {
        ctx.workspace.connect(externalHandle, sgHandle)
      } else {
        ctx.workspace.connect(sgHandle, externalHandle)
      }
    }
  }
}

function getMapKey(nodeId: number, handleKey: string) {
  return `${nodeId}:${handleKey}`
}

function getExternalHandleId(loc: INodeHandleLoc) {
  return `${loc.id}:${loc.key}`
}
