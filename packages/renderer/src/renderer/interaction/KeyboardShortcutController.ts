import type Konva from 'konva'
import type { Workspace } from '@0x-jerry/golden-graph'
import { ActiveType } from '@0x-jerry/golden-graph'
import {
  deleteGroupAction,
  deleteNodeAction,
  duplicateNodeAction,
} from '../ContextMenuBuilder'

export interface KeyboardShortcutControllerHost {
  stage: Konva.Stage
  ws: Workspace
}

const EDITABLE_TAG = /^(INPUT|TEXTAREA|SELECT)$/

/**
 * Keyboard shortcuts backing the actions also available in the context menu:
 *
 * - `Del` / `Backspace` — delete the active node(s); with an active group,
 *   delete the group together with its member nodes
 * - `Ctrl`/`Cmd` + `D` — duplicate the active node
 *
 * Shortcuts fire only while the canvas (the renderer container, which is
 * focusable via `tabindex="0"`) has keyboard focus; clicking the canvas
 * focuses it ({@link _onContainerPointerDown}). Events originating from
 * editable elements — e.g. the node text editor's hidden `<input>`, which
 * lives inside the stage content — never trigger shortcuts.
 */
export class KeyboardShortcutController {
  _stage: Konva.Stage
  _ws: Workspace

  constructor(host: KeyboardShortcutControllerHost) {
    this._stage = host.stage
    this._ws = host.ws

    const container = this._stage.container()
    container.addEventListener('keydown', this._onKeyDown)
    container.addEventListener('pointerdown', this._onContainerPointerDown)
  }

  dispose() {
    const container = this._stage.container()
    container.removeEventListener('keydown', this._onKeyDown)
    container.removeEventListener('pointerdown', this._onContainerPointerDown)
  }

  _onContainerPointerDown = (e: PointerEvent) => {
    // Never steal focus from a form control. The DOM target of a click on a
    // Konva-rendered editor (node text input, select, color picker) is the
    // canvas element, so the element that currently holds focus must be
    // checked too — the editor's hidden `<input>` stays focused mid-edit
    // while the click target is the canvas.
    const editable = (el: HTMLElement | null) =>
      el != null && (el.isContentEditable || EDITABLE_TAG.test(el.tagName))

    const target = e.target as HTMLElement | null
    if (editable(target)) return

    const active = document.activeElement as HTMLElement | null
    if (editable(active)) return

    // Focus on click so keyboard shortcuts fire only while the canvas holds
    // focus. `preventScroll` so focusing never nudges the page.
    this._stage.container().focus({ preventScroll: true })
  }

  _onKeyDown = (e: KeyboardEvent) => {
    // Keep IME composition (e.g. confirming CJK input) untouched.
    if (e.isComposing || e.keyCode === 229) return

    // Never fire during workflow execution or while the workspace is locked.
    if (this._ws.disabled) return

    // The node text editor's hidden `<input>` lives inside the stage content,
    // so its key events bubble up to this container listener — let editable
    // targets handle their own keys.
    const target = e.target as HTMLElement | null
    if (
      target &&
      (target.isContentEditable || EDITABLE_TAG.test(target.tagName))
    ) {
      return
    }

    const ctrl = e.ctrlKey || e.metaKey

    if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrl && !e.altKey) {
      this._deleteActive()
      e.preventDefault()
      return
    }

    if (e.key.toLowerCase() === 'd' && ctrl && !e.altKey && !e.shiftKey) {
      this._duplicateActive()
      e.preventDefault()
    }
  }

  _deleteActive() {
    const { activeIds, activeType } = this._ws.state
    const id = activeIds[0]
    if (id == null) return

    if (activeType === ActiveType.Node) {
      // Delete every selected node — matches the menu action extended to
      // multi-selection (box select / multiple active ids).
      deleteNodeAction(this._ws, activeIds)
    } else if (activeType === ActiveType.Group) {
      deleteGroupAction(this._ws, id)
    } else {
      return
    }

    // The selection ids now point at deleted entities; drop them so key
    // auto-repeat and follow-up shortcuts act on a clean slate.
    this._ws.clearActiveIds()
  }

  _duplicateActive() {
    const { activeIds, activeType } = this._ws.state
    const id = activeIds[0]
    if (activeType !== ActiveType.Node || id == null) return

    // The menu duplicates a single (right-clicked) node; keyboard duplicates
    // the first selected node for parity.
    duplicateNodeAction(this._ws, id)
  }
}
