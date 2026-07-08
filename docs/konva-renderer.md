# Konva Renderer

This document summarizes the changes made to add a Konva-based canvas renderer alongside the existing HTML/SVG renderer in **golden-graph**.

---

## Architecture

```
src/
├── core/          ← event system (additive), IRenderer interface
├── renderer/      ← NEW: Konva-based canvas renderer (konva JS API)
├── hooks/         ← unchanged (Vue composables for the HTML renderer)
├── handles/       ← unchanged (Vue handle content components)
├── components/    ← unchanged (Vue context menu, toolbar)
├── *.vue          ← unchanged (existing HTML/SVG renderer)
```

The two renderers coexist. Core emits events through `Workspace.events`. The Konva renderer subscribes to events and syncs its canvas scene. The HTML renderer continues to use Vue reactivity with no changes.

---

## Part 1: Event System (Core Changes)

### Design

All state mutations in core emit events on `Workspace.events`. Events follow the `entity:action` naming convention and are coarser-grained for simplicity (e.g., `node:changed` for any property change rather than `node:position-changed` / `node:handles-changed`).

### Event Interface

```ts
export interface WorkspaceEvents {
  // Lifecycle (existing, preserved)
  'node:added': [node: Node]
  'node:removed': [node: Node]
  'edge:added': [edge: Edge]
  'edge:removed': [edge: Edge]

  // Lifecycle (new)
  'group:added': [group: Group]
  'group:removed': [group: Group]
  'subgraph:added': [subgraph: SubGraph]
  'subgraph:removed': [subgraph: SubGraph]

  // Mutation (new)
  'node:changed': [node: Node]
  'group:changed': [group: Group]
  'coord:changed': [coord: CoordSystem]
  'state:changed': [state: WorkspaceState]
  'executor:changed': [state: ExecutorState]
  'contextmenu:changed': [state: ContextMenuHelperState]

  // Handle
  'handle:updated': [handle: NodeHandle]           // existing
  'handle:connection-changed': [handle: NodeHandle] // new
}
```

### Event Emission Points

| Class | Method | Event |
|---|---|---|
| `Node` | `move()`, `moveTo()`, `addHandle()` | `node:changed` |
| `NodeHandle` | `setValue()` | `handle:updated` |
| `NodeHandle` | `setConnectedHandle()` | `handle:connection-changed` |
| `Group` | `move()`, `setName()`, `setPos()`, `setSize()` | `group:changed` |
| `CoordSystem` | `zoomAt()`, `move()`, `reset()`, `fromJSON()` | `coord:changed` |
| `Executor` | `execute()` (start/end), `_process()` | `executor:changed` |
| `Workspace` | `addGroup()`, `removeGroup()` | `group:added` / `group:removed` |
| `Workspace` | `addSubGraph()`, `removeSubGraph()` | `subgraph:added` / `subgraph:removed` |
| `Workspace` | `setActiveIds()`, `setDebug()` | `state:changed` |
| `Workspace` | `showContextMenus()`, `hideContextMenus()` | `contextmenu:changed` |

### Modified Core Files

| File | Changes |
|---|---|
| `src/core/Workspace.ts` | Extended `WorkspaceEvents`, added `_renderer?: IRenderer`, `setRenderer()`, `new CoordSystem(this)`, `new ContextMenuHelper(this)`, event emissions in `addGroup/removeGroup/addSubGraph/removeSubGraph/setActiveIds/setDebug`. Replaced `getNodesBounding()` with `IRenderer.getNodesBounding()`. |
| `src/core/Node.ts` | Emit `node:changed` in `move()`, `moveTo()`, `addHandle()`. |
| `src/core/NodeHandle.ts` | Emit `handle:connection-changed` in `setConnectedHandle()`. |
| `src/core/Group.ts` | Emit `group:changed` in `move()`, `setName()`, `setPos()`, `setSize()`. |
| `src/core/CoordSystem.ts` | Added optional `_workspace` constructor param. Emit `coord:changed` in `zoomAt()`, `move()`, `reset()`, `fromJSON()`. |
| `src/core/Executor.ts` | Emit `executor:changed` in `execute()` (on start and in `finally`) and `_process()`. |
| `src/core/ContextMenu.ts` | Added optional `_workspace` constructor param. Emit `contextmenu:changed` in `show()` and `hide()`. |
| `src/core/types.ts` | Added `IRenderer` interface. |
| `src/core/index.ts` | Added `HandleComponent`, `CoordSystem` exports. |
| `src/core/GroupToSubGraph.ts` | Removed duplicate `node:added` emit (already emitted by `addRawNode()`). |
| `src/index.ts` | Added `KonvaGraphRenderer` export. |

### New Core Files

| File | Purpose |
|---|---|
| `src/core/HandleComponent.ts` | Generic `HandleComponentRegistry<T>` class — typed registry for handle component modules. Used by both renderers. |

### Backward Compatibility

- All existing methods, exports, and Vue reactivity stay intact
- Constructor params for `CoordSystem` and `ContextMenuHelper` are optional — omitting them means events don't fire
- All 22 existing tests pass without modification
- Playground and existing HTML renderer continue to work

---

## Part 2: Konva Renderer (`src/renderer/`)

### Design

A standalone TypeScript module using **Konva's JS API** (no vue-konva). The renderer class `KonvaGraphRenderer` implements `IRenderer` and manages a full canvas scene with 4 layers:

```
Stage
├── gridLayer   — static grid pattern (bottom)
├── groupLayer  — group bounding boxes (rect + text)
├── edgeLayer   — bezier curves between handles
└── nodeLayer   — node bodies, headers, handles (top)
```

### File Structure

```
src/renderer/
├── index.ts                    — exports KonvaGraphRenderer
├── types.ts                    — layout constants, color palette, entity entry types
├── KonvaGraphRenderer.ts      — main orchestrator
├── NodeRenderer.ts            — node Konva.Group creation & update
├── EdgeRenderer.ts            — bezier Konva.Line from handle positions
├── GroupRenderer.ts           — group rect + text
├── HandleRenderer.ts          — joint circles + handle content per node
├── CoordLayer.ts              — grid background
├── ConnectionLine.ts          — dashed bezier during drag-to-connect
├── InteractionManager.ts      — all pointer/keyboard events
└── handles/                   — Konva-based handle content
    ├── index.ts               — HandleComponentRegistry<HandleModule>
    ├── types.ts               — HandleModule interface
    ├── TextHandle.ts          — Konva.Text (display-only)
    ├── NumberHandle.ts        — Konva.Text showing name + value
    ├── SelectHandle.ts        — Konva.Text showing selected option
    ├── DisplayHandle.ts       — Konva.Text showing JSON.stringify
    ├── ImageHandle.ts         — Konva.Image from data URL
    └── DefaultHandle.ts       — Konva.Text showing handle name
```

### `KonvaGraphRenderer` — Main Class

```ts
class KonvaGraphRenderer implements IRenderer {
  constructor(container: HTMLElement, workspace: Workspace)
  getNodesBounding(nodeIds: number[]): { x, y, width, height }
  get stage(): Konva.Stage
  dispose(): void
}
```

**Lifecycle:**
1. Creates `Konva.Stage` sized to container
2. Creates 4 layers, adds grid to gridLayer
3. Subscribes to all `Workspace.events`
4. Calls `workspace.setRenderer(this)` — registers `IRenderer` for `addGroup()`
5. Performs initial full render from current workspace state
6. Creates `InteractionManager` for pointer/keyboard handling
7. Sets up `ResizeObserver` on container

**Event → Render mapping:**

| Event | Action |
|---|---|
| `node:added` | `NodeRenderer.create()` → add to `_nodeGroups` map → add to nodeLayer |
| `node:removed` | `NodeRenderer.destroy()` → remove from map → layer update |
| `node:changed` | `NodeRenderer.update()` → update position, name, height |
| `edge:added` | Rebuild all edges (due to lazy handle availability) |
| `edge:removed` | Rebuild all edges |
| `group:added` | `GroupRenderer.create()` → add to `_groupGroups` map |
| `group:removed` | `GroupRenderer.destroy()` → remove from map |
| `group:changed` | `GroupRenderer.update()` → update position, size, name |
| `coord:changed` | Sync `stage.scaleX/Y()` and `stage.x/y()` |
| `state:changed` | Update active state visual (border color on nodes/groups) |
| `executor:changed` | Toggle processing shadow on currently running node |
| `handle:updated` | Update handle text content in node |
| `handle:connection-changed` | Update joint circle fill (connected = accent color) + rebuild related edges |

**`getNodesBounding()` implementation:** Iterates `_nodeGroups` map for given IDs, reads node positions and computes height from handle count, returns union rect.

### Node Rendering (`NodeRenderer`)

Each node renders as a `Konva.Group` containing:
- **Body** `Rect` — white fill, gray stroke, dynamic height
- **Header** `Rect` — light gray fill, fixed height
- **Name** `Text` — node name
- **Handles** — left/right joints with circles + content via `HandleRenderer`
- **None handles** — text-only (no joint circle)

**Layout constants:**
- Node width: 200px
- Header height: 30px
- Handle row height: 28px
- Joint radius: 5px

**Height formula:** `HEADER_HEIGHT + handleCount * HANDLE_ROW_HEIGHT + 8`

### Edge Rendering (`EdgeRenderer`)

Bezier curves from right-side joints (output) to left-side joints (input):

```
src.control = (src.x + offset, src.y)   // extends right
dst.control = (dst.x - offset, dst.y)   // extends left
offset = clamp(|dx| / 2, 10, 200)
```

Joint positions are computed mathematically from `node.pos`, `LAYOUT` constants, and handle index — no DOM queries needed.

### Handle Rendering (`HandleRenderer`)

Joint circles use `Konva.Circle` positioned on the left or right edge of the node. The circle name uses format `joint-{nodeId}-{handleKey}` for hit detection by `InteractionManager`.

Handle content is delegated to handle modules from `handles/`. The `HandleModule` interface:

```ts
interface HandleModule {
  create(handle: NodeHandle, options: INodeHandleConfigOptions): Konva.Group
  update?(group: Konva.Group, handle: NodeHandle): void
  destroy?(group: Konva.Group): void
}
```

Connected joints render with accent fill; disconnected joints render with default fill.

### Interaction (`InteractionManager`)

Handles all user input through Konva's event system on the stage:

| Interaction | Trigger | Behavior |
|---|---|---|
| **Node click** | `pointerdown` on node group | `setActiveIds(nodeId)` — toggles with Shift |
| **Node drag** | `pointermove` after node down | `node.move(dx/scale, dy/scale)`. Multi-select: `moveActiveNodes()` |
| **Group drag** | `pointermove` after group down | `group.move({ x: dx/scale, y: dy/scale })` |
| **Canvas pan** | `pointermove` after empty area down | `coord.move(dx, dy)` |
| **Canvas zoom** | `wheel` | `coord.zoomAt(pointerPos, newScale)`, scale step varies by current scale |
| **Clear selection** | Empty area click | `clearActiveIds()` |
| **Connection start** | `pointerdown` on joint circle | Shows dashed connection line, auto-detaches existing connection on input side |
| **Connection move** | `pointermove` during connection | Updates temp bezier line |
| **Connection end** | `pointerup` → `stage.getIntersection()` | Finds target joint by name, calls `ws.connect()` |
| **Rubber-band select** | Shift + empty area drag | Draws selection `Rect`, on end: converts to workspace coords, selects enclosed nodes |

---

## Part 3: `IRenderer` Interface

```ts
// src/core/types.ts
export interface IRenderer {
  getNodesBounding(nodeIds: number[]): { x: number; y: number; width: number; height: number }
}
```

`Workspace.addGroup()` now requires a renderer to be set before calling. The renderer registers itself via `workspace.setRenderer(renderer)`.

The existing HTML renderer bridges to this via `domHelper.getNodesBounding()`. The Konva renderer implements it from its internal node map.

---

## Part 4: Usage

### Konva Renderer (new)

```ts
import { Workspace, KonvaGraphRenderer } from '@0x-jerry/golden-graph'

const ws = new Workspace()
ws.registerNode('MyNode', MyNode)

const renderer = new KonvaGraphRenderer(
  document.getElementById('app')!,
  ws
)

// Use workspace API as normal
const n1 = ws.addNode('MyNode', { pos: { x: 100, y: 100 } })
const n2 = ws.addNode('MyNode', { pos: { x: 300, y: 100 } })
ws.connect(n1.getHandle('output')!, n2.getHandle('input')!)

// Cleanup
renderer.dispose()
ws.dispose()
```

### HTML Renderer (unchanged)

```vue
<script setup>
import { GraphRenderer } from '@0x-jerry/golden-graph'
</script>
<template>
  <GraphRenderer :setup="(ws) => { /* ... */ }" />
</template>
```

---

## Part 5: Files Summary

### New Files (19)

```
src/core/HandleComponent.ts
src/renderer/index.ts
src/renderer/types.ts
src/renderer/KonvaGraphRenderer.ts
src/renderer/NodeRenderer.ts
src/renderer/EdgeRenderer.ts
src/renderer/GroupRenderer.ts
src/renderer/HandleRenderer.ts
src/renderer/CoordLayer.ts
src/renderer/ConnectionLine.ts
src/renderer/InteractionManager.ts
src/renderer/handles/types.ts
src/renderer/handles/index.ts
src/renderer/handles/TextHandle.ts
src/renderer/handles/NumberHandle.ts
src/renderer/handles/SelectHandle.ts
src/renderer/handles/DisplayHandle.ts
src/renderer/handles/ImageHandle.ts
src/renderer/handles/DefaultHandle.ts
```

### Modified Files (12)

```
src/core/Workspace.ts
src/core/Node.ts
src/core/NodeHandle.ts
src/core/Group.ts
src/core/CoordSystem.ts
src/core/Executor.ts
src/core/ContextMenu.ts
src/core/GroupToSubGraph.ts
src/core/types.ts
src/core/index.ts
src/index.ts
package.json                  (+ konva dependency)
```

### Unchanged Files

All `.vue` render components, `hooks/`, `handles/` (Vue), `components/`, `utils/`, `style/`, all test files.

### Dependencies

Added `konva ^10.3.0`.
