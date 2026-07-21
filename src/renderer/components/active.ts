export interface IActiveElement {
  deactivate(): void
}

let current: IActiveElement | null = null

export function getActiveElement(): IActiveElement | null {
  return current
}

export function setActiveElement(element: IActiveElement): void {
  if (current === element) return
  const prev = current
  current = element
  prev?.deactivate()
}

export function deactivateActiveElement(element: IActiveElement): void {
  if (current !== element) return
  current = null
  element.deactivate()
}
