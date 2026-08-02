import type { TextModel } from './TextModel'

export interface InputKeyEnv {
  sync(): void
  blink(): void
  commit(): void
  cancel(): void
  clearHidden(): void
}

export function handleInputKeyDown(model: TextModel, e: KeyboardEvent, env: InputKeyEnv): void {
  const ctrl = e.ctrlKey || e.metaKey
  const shift = e.shiftKey

  if (e.key === 'Enter') {
    e.preventDefault()
    env.commit()
    return
  }

  if (e.key === 'Escape') {
    e.preventDefault()
    env.cancel()
    return
  }

  if (handleEditingKey(model, e, ctrl, shift, env)) return

  if (e.key.length === 1 && !ctrl && !e.altKey) {
    e.preventDefault()
    model.insertText(e.key)
    env.clearHidden()
    env.sync()
    env.blink()
  }
}

function handleEditingKey(
  model: TextModel,
  e: KeyboardEvent,
  ctrl: boolean,
  shift: boolean,
  env: InputKeyEnv,
): boolean {
  const done = (): boolean => {
    env.sync()
    env.blink()
    return true
  }

  switch (e.key) {
    case 'Backspace':
      e.preventDefault()
      model.deleteBackward()
      return done()
    case 'Delete':
      e.preventDefault()
      model.deleteForward()
      return done()
    case 'ArrowLeft':
      e.preventDefault()
      model.moveLeft(shift)
      return done()
    case 'ArrowRight':
      e.preventDefault()
      model.moveRight(shift)
      return done()
    case 'Home':
      e.preventDefault()
      model.moveTo(0, shift)
      return done()
    case 'End':
      e.preventDefault()
      model.moveTo(model.value.length, shift)
      return done()
  }

  if (!ctrl) return false

  switch (e.key) {
    case 'a':
      e.preventDefault()
      model.selectAll()
      return done()
    case 'c':
      e.preventDefault()
      copySelection(model)
      return true
    case 'x':
      e.preventDefault()
      return cutSelection(model) ? done() : true
    case 'v':
      e.preventDefault()
      pasteText(model, env)
      return true
  }

  return false
}

function copySelection(model: TextModel) {
  const text = model.selectedText()
  if (text !== null) {
    getClipboard()?.writeText(text).catch(() => {})
  }
}

function cutSelection(model: TextModel): boolean {
  const text = model.selectedText()
  if (text === null) return false
  getClipboard()?.writeText(text).catch(() => {})
  model.deleteSelection()
  return true
}

function pasteText(model: TextModel, env: InputKeyEnv) {
  const clipboard = getClipboard()
  if (!clipboard) return
  clipboard
    .readText()
    .then((text) => {
      if (text) {
        model.insertText(text)
        env.sync()
        env.blink()
      }
    })
    .catch(() => {})
}

/**
 * `navigator.clipboard` is undefined on insecure origins (http/file) and in
 * some browsers — feature-detect instead of throwing inside a keydown handler.
 */
function getClipboard(): Clipboard | undefined {
  return typeof navigator !== 'undefined' ? navigator.clipboard : undefined
}
