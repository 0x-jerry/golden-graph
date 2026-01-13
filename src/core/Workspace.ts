import { shallowReactive } from "vue";
import { CoordSystem } from "./CoordSystem";
import { Edge } from "./Edge";
import { createIncrementIdGenerator, type Factory } from "./helper";
import type { Node, NodeBaseUpdateOptions } from "./Node";
import type { IPersistent } from "./Persistent";
import type { IWorkspace } from "./types";
import { Register } from "./Register";
import { nanoid, remove } from "@0x-jerry/utils";
import type { NodeHandle } from "./NodeHandle";

export class Workspace implements IPersistent<IWorkspace> {
  version = "1.0.0";
  id = nanoid();

  _nodes: Node[] = shallowReactive([]);
  _edges: Edge[] = shallowReactive([]);

  _idGenerator = createIncrementIdGenerator();

  _nodeRegister = new Register<Factory<Node>>();

  readonly coord = new CoordSystem();

  get nodes() {
    return this._nodes;
  }

  get edges() {
    return this._edges;
  }

  registerNode<T extends Node>(type: string, node: Factory<T>) {
    this._nodeRegister.set(type, node);
  }

  addNode<T extends NodeBaseUpdateOptions>(type: string, opt?: T) {
    const factory = this._nodeRegister.get(type);
    if (!factory) {
      throw new Error(`Node [${type}] is not registered!`);
    }

    const node = new factory();
    node._type = type

    node.setWorkspace(this)
    node.id = this.nextId();

    if (opt) {
      node.updateByOption(opt);
    }

    this._nodes.push(node);
    return node;
  }

  removeNodeById(id: number) {
    return remove(this._nodes, (n) => n.id === id);
  }

  getNode(id: number) {
    return this.nodes.find(n => n.id === id);
  }

  connect(start: NodeHandle, end: NodeHandle) {
    const edge = new Edge();
    edge.setWorkspace(this)
    edge.id = this.nextId()

    edge.setStart(start);
    edge.setEnd(end);

    this._edges.push(edge);

    return edge
  }

  nextId() {
    return this._idGenerator.next();
  }

  toJSON(): IWorkspace {
    return {
      version: this.version,
      coordinate: this.coord.toJSON(),
      nodes: this.nodes.map(n => n.toJSON()),
      edges: this.edges.map(n => n.toJSON()),
      extra: {
        incrementID: this._idGenerator.current()
      }
    }
  }

  fromJSON(data: IWorkspace): void {
    this._idGenerator.reset(data.extra.incrementID)

    for (const node of data.nodes) {
      const n = this.addNode(node.type)

      n.fromJSON(node)
    }

    for (const edgeData of data.edges) {
      const edge = new Edge()
      edge.setWorkspace(this)

      edge.fromJSON(edgeData)
      this._edges.push(edge)
    }
  }
}
