import { useWorkspace } from "./useWorkspace";

export function useCoordSystem() {
  const state = useWorkspace()!;

  return state.coord;
}
