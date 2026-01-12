import { shallowRef } from "vue";
import type { NodeHandle } from "./NodeHandle";
import type { IPersistent } from "./Persistent";
import type { IEdge } from "./types";

export class Edge implements IPersistent<IEdge> {
  _start = shallowRef<NodeHandle>();
  _end = shallowRef<NodeHandle>();

  toJSON(): IEdge {
    throw new Error("Method not implemented.");
  }

  fromJSON(data: IEdge): void {
    throw new Error("Method not implemented.");
  }
}
