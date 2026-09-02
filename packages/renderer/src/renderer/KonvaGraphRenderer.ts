import Konva from 'konva'
import type { IDisposable, IRenderer, Workspace } from '@0x-jerry/golden-graph'
import { ActiveType, Disposable, isSubGraphNode } from '@0x-jerry/golden-graph'
import { CoordLayer } from './CoordLayer'
import { InteractionManager } from './interaction/InteractionManager'
import { KeyboardShortcutController } from './interaction/KeyboardShortcutController'
import type { ContextMenuContext, CoreMenuItem } from './types'
import { disposeHandleEditors } from './handles'
import { disposeTooltip } from './tooltip'
import { LAYER_NAME } from './constants'
import type { IRect } from '../utils/RectBox'
import { ActiveElementManager } from './ActiveElementManager'
import { EntityViewStore } from './EntityViewStore'
import { GraphStateSyncer } from './GraphStateSyncer'
import { subscribeGraphEvents } from './GraphEventRouter'
import { layoutWorkspace } from './layoutWorkspace'
import { attachStageCursorCenter } from './cursor'
import { ThemeContext } from '../theme'
import type { DeepPartial, GraphTheme } from '../theme'

export interface KonvaGraphRendererOptions {
  onContextMenu?: (
    ctx: ContextMenuContext,
    evt: PointerEvent,
    menus: CoreMenuItem[],
  ) => void
  /**
   * When `true` (default), a freshly created subgraph's inner workspace is
   * auto-laid-out so its nodes are arranged instead of scattered.
   */
  autoLayoutSubGraph?: boolean
  /**
   * Screen-pixel radius that auto-targets a joint during a connection drag.
   * `0` disables proximity so only exact pointer hits connect.
   */
  proximityRadius?: number
  /** Partial theme merged over the defaults. Hot-swappable via `setTheme`. */
  theme?: DeepPartial<GraphTheme>
}

export class KonvaGraphRenderer implements IRenderer, IDisposable {
  _stage: Konva.Stage
  _gridLayer: CoordLayer
  _disposers = new Disposable()
  _ws: Workspace

  _store: EntityViewStore
  _syncer: GraphStateSyncer

  _interaction: InteractionManager
  _resizeObserver: ResizeObserver
  _disposed = false
  _activeElementManager: ActiveElementManager
  _autoLayoutSubGraph: boolean
  /** Per-renderer theme; hot-swapping re-applies to every live view. */
  _theme: ThemeContext

  get stage(): Konva.Stage {
    return this._stage
  }

  /** Current merged theme (defaults + consumer overrides). */
  get theme(): GraphTheme {
    return this._theme.value
  }

  constructor(
    container: HTMLElement,
    workspace: Workspace,
    options?: KonvaGraphRendererOptions,
  ) {
    this._autoLayoutSubGraph = options?.autoLayoutSubGraph ?? true
    this._ws = workspace
    this._theme = new ThemeContext(options?.theme)

    this._stage = new Konva.Stage({
      container: container as HTMLDivElement,
      width: container.clientWidth,
      height: container.clientHeight,
    })

    this._activeElementManager = new ActiveElementManager(this._stage)
    this._stage.setAttr(ActiveElementManager.key, this._activeElementManager)
    this._activeElementManager.init()

    this._gridLayer = new CoordLayer(workspace.coord, this._theme.value)
    this._store = new EntityViewStore(workspace, this._theme)

    this._stage.add(this._gridLayer)
    this._stage.add(this._store.groupLayer)
    this._stage.add(this._store.edgeLayer)
    this._stage.add(this._store.nodeLayer)

    // After the layers exist so the center can listen to their redraws.
    this._disposers.add(attachStageCursorCenter(this._stage))

    this._syncer = new GraphStateSyncer(workspace, this._stage, this._store)

    this._subscribe()

    workspace.setRenderer(this)

    this._fullRender()

    this._interaction = new InteractionManager({
      stage: this._stage,
      ws: workspace,
      proximityRadius: options?.proximityRadius,
      theme: this._theme.value,
    })

    this._disposers.add(
      this._theme.onThemeChange(() => this._applyTheme()),
    )

    this._disposers.add(
      this._interaction.on('node-select', (id) => {
        workspace.setActiveIds(ActiveType.Node, [id])
      }),
    )
    this._disposers.add(
      this._interaction.on('node-dblclick', (id) => {
        const node = workspace.getNode(id)
        if (isSubGraphNode(node)) {
          workspace.enterSubGraph(node.subGraphId!)
        }
      }),
    )
    this._disposers.add(
      this._interaction.on('context-menu', (ctx, evt, menus) => {
        options?.onContextMenu?.(ctx, evt, menus)
      }),
    )
    this._disposers.add(
      this._interaction.on('overlay-render', ({ shape, layer }) => {
        const target =
          layer === LAYER_NAME.EDGES
            ? this._store.edgeLayer
            : this._store.nodeLayer

        target.add(shape)
        target.batchDraw()
      }),
    )

    this._disposers.add(
      new KeyboardShortcutController({ stage: this._stage, ws: workspace }),
    )

    this._resizeObserver = new ResizeObserver(() => {
      this._stage.width(container.clientWidth)
      this._stage.height(container.clientHeight)
      this._gridLayer.batchDraw()
    })
    this._resizeObserver.observe(container)
  }

  // --- IRenderer implementation ---

  getNodesBounding(nodeIds: number[]): IRect {
    return this._store.getNodesBounding(nodeIds)
  }

  getViewportCenter() {
    return {
      x: this._stage.width() / 2,
      y: this._stage.height() / 2,
    }
  }

  // --- Event Subscription ---

  _subscribe() {
    subscribeGraphEvents(this._ws, this._store, this._syncer, this._disposers)

    if (this._autoLayoutSubGraph) {
      this._disposers.add(
        this._ws.events.on('subgraph:added', (subGraph) => {
          layoutWorkspace(subGraph.workspace)
        }),
      )
    }
  }

  // --- Full Render ---

  _fullRender() {
    this._store.renderAll()
    this._syncer.syncCoord()
    this._syncer.syncState()
  }

  /**
   * Hot-swap the theme and re-apply to every live surface. The patch REPLACES
   * the previous overrides — pass the complete set each time (it's merged over
   * the defaults; `{}` resets to the default theme).
   */
  setTheme(theme: DeepPartial<GraphTheme>): void {
    this._theme.setTheme(theme)
  }

  _applyTheme() {
    const theme = this._theme.value
    this._gridLayer.applyTheme(theme)
    this._store.applyTheme(theme)
    this._interaction.applyTheme(theme)
    this._gridLayer.batchDraw()
    this._store.redrawNodes()
    this._store.redrawEdges()
    this._store.redrawGroups()
  }

  // --- Lifecycle ---

  dispose() {
    this._disposed = true

    this._activeElementManager.dispose()
    this._disposers.dispose()
    this._interaction.dispose()
    this._resizeObserver.disconnect()
    disposeHandleEditors()
    disposeTooltip()

    this._store.destroyAll()

    this._stage.destroy()

    // Detach from the workspace so later core calls (e.g. addGroup) fail
    // with a clear error instead of touching a destroyed stage.
    this._ws.setRenderer(undefined)
  }
}
