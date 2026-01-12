import type { IPersistent } from "./Persistent";
import type { INode } from "./types";

export class Node implements IPersistent<INode> {
  id = 0;
  name = "Node";
  description?: string;

  _data: Record<string, unknown> = {};

  pos = { x: 0, y: 0 };

  handles = [];

  getData<T>(key: string): T | undefined {
    return this._data[key] as T | undefined;
  }

  setData(key: string, value: unknown) {
    this._data[key] = value;
  }

  onProcess?: (instance: this) => unknown;

  move(x: number, y: number) {
    this.pos.x += x;
    this.pos.y += y;
  }

  moveTo(x: number, y: number) {
    this.pos.x = x;
    this.pos.y = y;
  }

  toJSON(): INode {
    throw new Error("Method not implemented.");
  }

  fromJSON(data: INode): void {
    throw new Error("Method not implemented.");
  }
}
