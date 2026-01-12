import { defineContext } from "@0x-jerry/vue-kit";
import { Workspace } from "../core";

export const useWorkspace = defineContext(Symbol.for("graph-workspace"), () => {
  return new Workspace();
});
