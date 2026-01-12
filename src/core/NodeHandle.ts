import { HandlePosition } from "./HandlePosition";
import type { Node } from "./Node";
import type { IPersistent } from "./Persistent";
import type { INodeHandle } from "./types";

export class NodeHandle implements IPersistent<INodeHandle> {
  type = "default";

  key = "";

  name = "Default Handle";

  position = HandlePosition.None;

  _node?: Node;

  get isOutput() {
    return this.position === HandlePosition.Right;
  }

  get isInput() {
    return this.position === HandlePosition.Left;
  }

  get node() {
    return this._node;
  }

  update(newValue?: unknown) {
    this._node?.setData(this.key, newValue);
  }

  getValue() {
    return this._node?.getData(this.key);
  }

  setNode(node: Node) {
    this._node = node;
  }

  toJSON(): INodeHandle {
    throw new Error("Method not implemented.");
  }

  fromJSON(data: INodeHandle): void {
    throw new Error("Method not implemented.");
  }
}
