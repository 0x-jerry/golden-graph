export interface HiddenInputEvents {
  onInsert: (text: string) => void
  onCompose: (text: string) => void
}

export class HiddenInput {
  static _sharedInput: HTMLInputElement | null = null
  static _active: HiddenInput | null = null

  static _ensureSharedInput(): HTMLInputElement {
    if (!HiddenInput._sharedInput) {
      const input = document.createElement('input')
      input.style.cssText =
        'position:absolute;opacity:0;width:1px;height:1px;left:-9999px;top:-9999px;'
      input.setAttribute('autocomplete', 'off')
      input.addEventListener('compositionstart', HiddenInput._compStartFn)
      input.addEventListener('compositionend', HiddenInput._compEndFn)
      input.addEventListener('input', HiddenInput._inputFn)
      HiddenInput._sharedInput = input
    }
    return HiddenInput._sharedInput
  }

  static _compStartFn = () => {
    const active = HiddenInput._active
    const input = HiddenInput._sharedInput
    if (active && input) {
      active._composing = true
      active._compBase = input.value
    }
  }

  static _compEndFn = () => {
    const active = HiddenInput._active
    const input = HiddenInput._sharedInput
    if (active && input) {
      active._composing = false
      const text = input.value.slice(active._compBase.length)
      input.value = ''
      active._compBase = ''
      active._composingText = ''
      if (text) {
        active._events.onInsert(text)
      }
    }
  }

  static _inputFn = (e: Event) => {
    const input = e.target as HTMLInputElement
    const active = HiddenInput._active
    if (!active) return
    if (active._composing) {
      active._composingText = input.value.slice(active._compBase.length)
      active._events.onCompose(active._composingText)
      return
    }
    if (input.value) {
      const text = input.value
      input.value = ''
      active._events.onInsert(text)
    }
  }

  _events: HiddenInputEvents

  _composing = false
  _composingText = ''
  _compBase = ''

  constructor(events: HiddenInputEvents) {
    this._events = events
  }

  get composing(): boolean {
    return this._composing
  }

  get composingText(): string {
    return this._composingText
  }

  attach(container: HTMLElement) {
    const input = HiddenInput._ensureSharedInput()
    if (input.parentElement !== container) {
      container.appendChild(input)
    }
    HiddenInput._active = this
  }

  focus() {
    requestAnimationFrame(() => {
      HiddenInput._sharedInput?.focus()
    })
  }

  setPosition(x: number, y: number) {
    if (!HiddenInput._sharedInput) return
    HiddenInput._sharedInput.style.left = `${x}px`
    HiddenInput._sharedInput.style.top = `${y}px`
  }

  clear() {
    if (HiddenInput._sharedInput) {
      HiddenInput._sharedInput.value = ''
    }
  }

  detach() {
    if (HiddenInput._active === this) {
      HiddenInput._active = null
    }
    this._composing = false
    this._composingText = ''
    this._compBase = ''
  }
}
