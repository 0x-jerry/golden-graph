import { defineContext } from "@0x-jerry/vue-kit";
import type { IEdge, INode, IWorkspace } from "../core";
import { useCoordSystem, type IUseCoordSystemReturn } from "./useCoordSystem";

function createIncrementIdGenerator() {
  let id = 0;

  return {
    reset(start: number) {
      id = start;
    },
    next() {
      return ++id;
    },
  };
}

class Workspace implements IWorkspace {
  version = "1.0.0";
  id: number;

  coordinate: IUseCoordSystemReturn;

  nodes: INode[] = [];
  edges: IEdge[] = [];

  _idGenerator = createIncrementIdGenerator();

  constructor() {
    this.id = this.nextId();
    this.coordinate = useCoordSystem.provide();
  }

  nextId() {
    return this._idGenerator.next();
  }
}

export const useWorkspace = defineContext(Symbol.for("graph-workspace"), () => {
  return new Workspace();
});
