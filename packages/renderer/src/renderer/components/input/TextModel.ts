export interface TextModelOptions {
  value: string
  beforeChange?: (value: string) => string
  measure: (text: string) => number
}

export class TextModel {
  _val: string = ''
  _committed: string
  _cursorPos: number
  _selAnchor: number
  _beforeChange?: (value: string) => string
  _measure: (text: string) => number

  constructor(options: TextModelOptions) {
    this._beforeChange = options.beforeChange
    this._measure = options.measure

    this.setVal(options.value)

    this._committed = this._val
    this._cursorPos = this._val.length
    this._selAnchor = -1
  }

  get value(): string {
    return this._val
  }

  get committed(): string {
    return this._committed
  }

  get cursorPos(): number {
    return this._cursorPos
  }

  get selAnchor(): number {
    return this._selAnchor
  }

  setVal(next: string) {
    this._val = this._beforeChange ? this._beforeChange(next) : next
    if (this._cursorPos > this._val.length) {
      this._cursorPos = this._val.length
    }
  }

  commit() {
    this._committed = this._val
  }

  revert() {
    this._val = this._committed
  }

  reset(value: string) {
    this.setVal(value)
    this._committed = this._val
    this._cursorPos = this._val.length
    this._selAnchor = -1
  }

  setCursor(pos: number) {
    this._cursorPos = pos
    this._selAnchor = -1
  }

  moveCursorTo(pos: number) {
    this._cursorPos = pos
  }

  setSelection(anchor: number, cursor: number) {
    this._selAnchor = anchor
    this._cursorPos = cursor
  }

  clearSelection() {
    this._selAnchor = -1
  }

  selectAll() {
    this._cursorPos = this._val.length
    this._selAnchor = 0
  }

  selRange(): [number, number] | null {
    if (this._selAnchor < 0 || this._selAnchor === this._cursorPos) return null
    return this._selAnchor < this._cursorPos
      ? [this._selAnchor, this._cursorPos]
      : [this._cursorPos, this._selAnchor]
  }

  selectedText(): string | null {
    const range = this.selRange()
    return range ? this._val.slice(range[0], range[1]) : null
  }

  deleteSelection(): boolean {
    const range = this.selRange()
    if (!range) return false
    const [s, e] = range
    const next = this._val.slice(0, s) + this._val.slice(e)
    this._cursorPos = s
    this._selAnchor = -1
    this.setVal(next)
    return true
  }

  insertText(text: string) {
    this.deleteSelection()
    const pos = this._cursorPos
    const next = this._val.slice(0, pos) + text + this._val.slice(pos)
    this.setVal(next)
    this._cursorPos = Math.min(pos + text.length, this._val.length)
    this._selAnchor = -1
  }

  deleteBackward() {
    if (!this.deleteSelection() && this._cursorPos > 0) {
      const pos = this._cursorPos
      this.setVal(this._val.slice(0, pos - 1) + this._val.slice(pos))
      this._cursorPos = Math.min(pos - 1, this._val.length)
    }
  }

  deleteForward() {
    if (!this.deleteSelection()) {
      const pos = this._cursorPos
      this.setVal(this._val.slice(0, pos) + this._val.slice(pos + 1))
      this._cursorPos = Math.min(pos, this._val.length)
    }
  }

  moveLeft(shift: boolean) {
    if (shift) {
      if (this._selAnchor < 0) this._selAnchor = this._cursorPos
      if (this._cursorPos > 0) {
        this._cursorPos--
      }
    } else {
      const range = this.selRange()
      this._selAnchor = -1
      if (range) {
        this._cursorPos = range[0]
      } else if (this._cursorPos > 0) {
        this._cursorPos--
      }
    }
  }

  moveRight(shift: boolean) {
    if (shift) {
      if (this._selAnchor < 0) this._selAnchor = this._cursorPos
      if (this._cursorPos < this._val.length) {
        this._cursorPos++
      }
    } else {
      const range = this.selRange()
      this._selAnchor = -1
      if (range) {
        this._cursorPos = range[1]
      } else if (this._cursorPos < this._val.length) {
        this._cursorPos++
      }
    }
  }

  moveTo(pos: number, shift: boolean) {
    if (shift) {
      if (this._selAnchor < 0) this._selAnchor = this._cursorPos
    } else {
      this._selAnchor = -1
    }
    this._cursorPos = pos
  }

  textWidth(str: string): number {
    return this._measure(str)
  }

  cursorX(pos: number): number {
    return this._measure(this._val.slice(0, pos))
  }

  posFromX(x: number): number {
    if (x <= 0) return 0
    const len = this._val.length
    for (let i = 0; i < len; i++) {
      const w = this._measure(this._val.slice(0, i + 1))
      if (x < w) {
        const prev = this._measure(this._val.slice(0, i))
        return x - prev < w - x ? i : i + 1
      }
    }
    return len
  }
}
