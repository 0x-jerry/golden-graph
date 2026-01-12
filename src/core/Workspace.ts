import { shallowReactive } from "vue";
import { CoordSystem } from "./CoordSystem";
import { Edge } from "./Edge";
import { createIncrementIdGenerator, type Factory } from "./helper";
import type { Node } from "./Node";
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

  addNode(type: string, opt?: Record<string, unknown>) {
    const factory = this._nodeRegister.get(type);
    if (!factory) {
      throw new Error(`Node [${type}] is not registered!`);
    }

    const node = new factory();
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

  connect(start: NodeHandle, end: NodeHandle) {
    const edge = new Edge();
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
    throw new Error("Method not implemented.");
  }

  fromJSON(data: IWorkspace): void {
    throw new Error("Method not implemented.");
  }
}
