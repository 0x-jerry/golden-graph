import { shallowReactive } from "vue";
import type { IPersistent } from "./Persistent";
import type { INode } from "./types";
import type { NodeHandle } from "./NodeHandle";
import type { Workspace } from "./Workspace";

export class Node implements IPersistent<INode> {
  id = 0;
  name = "Node";
  description?: string;

  _data: Record<string, unknown> = shallowReactive({});

  pos = shallowReactive({ x: 0, y: 0 });

  _handles: NodeHandle[] = shallowReactive([]);

  _workspace?: Workspace;

  get workspace() {
    if (!this._workspace) {
      throw new Error(`Workspace is not set!`)
    }

    return this._workspace;
  }

  get handles() {
    return this._handles as readonly NodeHandle[];
  }

  getData<T>(key: string): T | undefined {
    return this._data[key] as T | undefined;
  }

  setData(key: string, value: unknown) {
    this._data[key] = value;
  }

  setWorkspace(w: Workspace) {
    this._workspace = w;
  }

  updateByOption(opt: Record<string, any>) {
    if (opt.name) {
      this.name = opt.name;
    }

    if (opt.description) {
      this.description = opt.description;
    }

    if (opt.data) {
      Object.assign(this._data, opt.data);
    }
  }

  addHandle(handle: NodeHandle) {
    handle.setNode(this);
    this._handles.push(handle);
  }

  getHandle(key: string) {
    return this.handles.find((n) => n.key === key);
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
