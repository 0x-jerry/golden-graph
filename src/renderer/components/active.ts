export interface ActiveElement {
  deactivate(): void
}

let current: ActiveElement | null = null

export function getActiveElement(): ActiveElement | null {
  return current
}

export function setActiveElement(element: ActiveElement): void {
  if (current === element) return
  const prev = current
  current = element
  prev?.deactivate()
}

export function deactivateActiveElement(element: ActiveElement): void {
  if (current !== element) return
  current = null
  element.deactivate()
}
