/**
 * Re-export shim — the implementation lives in `./workspace/Workspace`.
 *
 * Kept at this path so intra-package relative imports (Node, Edge, Group,
 * SubGraph, CoordSystem, Executor, …) keep resolving unchanged.
 */
export * from './workspace/Workspace'
