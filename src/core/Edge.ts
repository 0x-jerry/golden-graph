import type { NodeHandle } from "./NodeHandle";
import type { IPersistent } from "./Persistent";
import type { IEdge } from "./types";

export class Edge implements IPersistent<IEdge> {
  start?: NodeHandle;
  end?: NodeHandle;

  toJSON(): IEdge {
    throw new Error("Method not implemented.");
  }

  fromJSON(data: IEdge): void {
    throw new Error("Method not implemented.");
  }
}
