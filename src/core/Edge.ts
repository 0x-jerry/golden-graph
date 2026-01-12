import { shallowRef } from "vue";
import type { NodeHandle } from "./NodeHandle";
import type { IPersistent } from "./Persistent";
import type { IEdge } from "./types";

export class Edge implements IPersistent<IEdge> {
  id = 0;

  _start = shallowRef<NodeHandle>();
  _end = shallowRef<NodeHandle>();

  get start() {
    return this._start.value as NodeHandle;
  }

  get end() {
    return this._end.value as NodeHandle;
  }

  setStart(start: NodeHandle) {
    this._start.value = start;
  }

  setEnd(end: NodeHandle) {
    this._end.value = end;
  }

  toJSON(): IEdge {
    throw new Error("Method not implemented.");
  }

  fromJSON(data: IEdge): void {
    throw new Error("Method not implemented.");
  }
}
