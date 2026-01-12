import { CoordSystem } from "./CoordSystem";
import type { Edge } from "./Edge";
import { createIncrementIdGenerator } from "./helper";
import type { Node } from "./Node";
import type { IPersistent } from "./Persistent";
import type { IWorkspace } from "./types";

export class Workspace implements IPersistent<IWorkspace> {
  version = "1.0.0";
  id: number;

  _nodes: Node[] = [];
  _edges: Edge[] = [];

  _coord = new CoordSystem()

  _idGenerator = createIncrementIdGenerator();

  constructor() {
    this.id = this.nextId();
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
