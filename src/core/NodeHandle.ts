import type { Arrayable } from "@0x-jerry/utils";
import { HandlePosition } from "./HandlePosition";
import type { Node } from "./Node";
import type { IPersistent } from "./Persistent";
import type { INodeHandle } from "./types";
import { getNodeHandleDom } from "./dom";

export class NodeHandle implements IPersistent<INodeHandle> {
  type: Arrayable<string> = "default";

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
    if (!this._node) {
      throw new Error(`Node is not set`);
    }

    return this._node;
  }

  getDom() {
    const nodeId = this.node.id;
    const wsId = this.node.workspace.id;

    return getNodeHandleDom(wsId, nodeId, this.key);
  }

  getJointDom() {
    return this.getDom()?.querySelector(`[role="handle-joint"]`) as
      | HTMLElement
      | null
      | undefined;
  }

  setNode(node: Node) {
    this._node = node;
  }

  toJSON(): INodeHandle {
    return {
      key: this.key,
      name: this.name,
      type: this.type,
      position: this.position
    }
  }

  fromJSON(data: INodeHandle): void {
    this.key = data.key
    this.name = data.name
    this.type = data.key
    this.position = data.position
  }
}
