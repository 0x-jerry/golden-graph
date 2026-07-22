export interface HiddenInputEvents {
  onInsert: (text: string) => void
  onCompose: (text: string) => void
}

export class HiddenInput {
  _input: HTMLInputElement | null = null
  _events: HiddenInputEvents

  _composing = false
  _composingText = ''
  _compBase = ''

  _compStartFn = () => {
    this._composing = true
    this._compBase = this._input?.value ?? ''
  }

  _compEndFn = () => {
    this._composing = false
    if (this._input) {
      const text = this._input.value.slice(this._compBase.length)
      this._input.value = ''
      this._compBase = ''
      this._composingText = ''
      if (text) {
        this._events.onInsert(text)
      }
    }
  }

  _inputFn = (e: Event) => {
    const input = e.target as HTMLInputElement
    if (this._composing) {
      this._composingText = input.value.slice(this._compBase.length)
      this._events.onCompose(this._composingText)
      return
    }
    if (input.value) {
      const text = input.value
      input.value = ''
      this._events.onInsert(text)
    }
  }

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
    const input = document.createElement('input')
    input.style.cssText = 'position:absolute;opacity:0;width:1px;height:1px;'
    input.setAttribute('autocomplete', 'off')
    container.appendChild(input)
    input.addEventListener('compositionstart', this._compStartFn)
    input.addEventListener('compositionend', this._compEndFn)
    input.addEventListener('input', this._inputFn)
    this._input = input
  }

  focus() {
    setTimeout(() => {
      this._input?.focus()
    })
  }

  setPosition(x: number, y: number) {
    if (!this._input) return
    this._input.style.left = `${x}px`
    this._input.style.top = `${y}px`
  }

  clear() {
    if (this._input) {
      this._input.value = ''
    }
  }

  detach() {
    if (this._input) {
      this._input.removeEventListener('compositionstart', this._compStartFn)
      this._input.removeEventListener('compositionend', this._compEndFn)
      this._input.removeEventListener('input', this._inputFn)
      this._input.remove()
      this._input = null
    }
    this._composing = false
    this._composingText = ''
    this._compBase = ''
  }
}
