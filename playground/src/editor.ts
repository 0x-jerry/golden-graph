import { Node, NodeHandle, Workspace } from "../../src/core";
import { HandlePosition } from "../../src/core/HandlePosition";

export function setup(workspace: Workspace) {
  workspace.registerNode("Number", NumberNode);
  workspace.registerNode("ToString", ToStringNode);

  const n1 = workspace.addNode("Number");
  n1.moveTo(100, 100);

  const n2 = workspace.addNode("ToString");

  n2.moveTo(200, 200);

  workspace.connect(n1.getHandle("output")!, n2.getHandle("input")!);

  return workspace;
}

class NumberNode extends Node {
  constructor() {
    super();

    this.name = "Number Node";

    const numberHandle = new NodeHandle();
    numberHandle.key = "output";
    numberHandle.name = "Number";
    numberHandle.position = HandlePosition.Right;
    numberHandle.type = "number";

    this.addHandle(numberHandle);
    this.setData("output", 10);
  }
}

class ToStringNode extends Node {
  constructor() {
    super();

    this.name = "ToString";

    const inputHandle = new NodeHandle();
    inputHandle.key = "input";
    inputHandle.name = "Input";
    inputHandle.position = HandlePosition.Left;
    inputHandle.type = "number";

    this.addHandle(inputHandle);

    const outputHandle = new NodeHandle();
    outputHandle.key = "output";
    outputHandle.name = "Output";
    outputHandle.position = HandlePosition.Right;
    outputHandle.type = "string";

    this.addHandle(outputHandle);
  }
}
