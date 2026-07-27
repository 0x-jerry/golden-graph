import type { ExecutorBackend, ExecutorBackendEvent } from './ExecutorBackend'
import { toReadonly } from './helper'
import type { Node } from './Node'
import type { Workspace } from './Workspace'

/**
 * Frontend facade for workflow execution.
 *
 * The core never executes workflows itself: execution always happens on
 * an {@link ExecutorBackend}, which receives the workspace snapshot as
 * plain JSON and streams progress + handle value writes back. This facade
 * owns the re-entrancy guard, mirrors the `executor:changed` state, and
 * applies backend writes so events and UI behave like a local run.
 */
export class Executor {
  backend?: ExecutorBackend

  constructor(
    readonly ws: Workspace,
    backend?: ExecutorBackend,
  ) {
    this.backend = backend
  }

  _state = {
    isProcessing: false,
    currentNodeId: 0,
  }

  get state() {
    return toReadonly(this._state)
  }

  async execute(entryNodes: Node[]) {
    if (this._state.isProcessing) {
      console.warn('Executor is running')
      return
    }

    const backend = this.backend

    if (!backend) {
      throw new Error(
        'Can not execute: no executor backend is configured. ' +
          'Pass `executorBackend` to the Workspace options.',
      )
    }

    try {
      this._state.isProcessing = true
      this._state.currentNodeId = -1
      this.ws.events.emit('executor:changed', this._state)

      await backend.execute(
        {
          snapshot: this.ws.toJSON(),
          entryNodeIds: entryNodes.map((node) => node.id),
          debug: this.ws.state.debug,
        },
        (event) => this._handleBackendEvent(event),
      )
    } catch (error) {
      throw new Error(String(error), { cause: error })
    } finally {
      this._state.isProcessing = false
      this._state.currentNodeId = -1
      this.ws.events.emit('executor:changed', this._state)
    }
  }

  _handleBackendEvent(event: ExecutorBackendEvent) {
    switch (event.type) {
      case 'progress':
        this._state.currentNodeId = event.currentNodeId
        this.ws.events.emit('executor:changed', this._state)
        break

      case 'handle-updates':
        for (const update of event.updates) {
          this.ws.getNode(update.nodeId)?.setData(update.key, update.value)
        }
        break

      case 'finish':
        // The run result is delivered through the backend's promise.
        break
    }
  }
}
