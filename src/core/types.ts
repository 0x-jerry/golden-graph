import type { Arrayable } from "@0x-jerry/utils";
import type { HandlePosition } from "./HandlePosition";

export interface IVec2 {
  x: number;
  y: number;
}

export interface INodeHandle {
  key: string;
  type: Arrayable<string>;

  name: string;

  position: HandlePosition;
}

export interface INode {
  id: number;
  type: string;
  name: string;
  description?: string;

  handles: INodeHandle[];

  data?: Record<string, unknown>;

  pos: IVec2;
}

interface INodeHandleLoc {
  /**
   * Node ID
   */
  id: number;
  /**
   * Handle Key
   */
  key: string;
}

export interface IEdge {
  id: number;

  type: string;

  start: INodeHandleLoc;

  end: INodeHandleLoc;
}

export interface ICoordinate {
  origin: IVec2;
  scale: number;
}

export interface IWorkspace {
  /**
   * For data migration
   */
  version: string;

  id: number;

  extra: {
    incrementID: number
  }

  coordinate: ICoordinate;

  nodes: INode[];
  edges: IEdge[];
}

export type ObjectAny = Record<string, any>