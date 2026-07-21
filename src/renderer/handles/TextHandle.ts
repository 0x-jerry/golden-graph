import Konva from 'konva'
import type { NodeHandle } from '../../core'
import { COLORS } from '../constants'
import { closeOverlayOnCoordChange, positionOverlay } from './overlay'
import { availableWidth } from './utils'
import type { HandleModule } from './types'

export const type = 'text'

const INPUT_HEIGHT = 18

let sharedInput: HTMLInputElement | null = null
let currentHandle: NodeHandle | null = null
let unsubscribeCoord: (() => void) | null = null

function getSharedInput(): HTMLInputElement {
  if (!sharedInput) {
    sharedInput = document.createElement('input')
    sharedInput.type = 'text'
    sharedInput.style.cssText = `
      box-sizing: border-box;
      position: fixed;
      font-family: Arial, sans-serif;
      font-size: 12px;
      color: ${COLORS.TEXT_PRIMARY};
      padding: 0 4px;
      background: ${COLORS.BG};
      border-color: transparent;
      outline: none;
      box-sizing: border-box;
      z-index: 9999;
      display: none;
    `
    document.body.appendChild(sharedInput)

    sharedInput.addEventListener('blur', finishEdit)
    sharedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        sharedInput!.blur()
      } else if (e.key === 'Escape') {
        if (currentHandle) {
          sharedInput!.value = String(currentHandle.getRealValue() ?? '')
        }
        sharedInput!.blur()
      }
    })
  }
  return sharedInput
}

function finishEdit() {
  if (!currentHandle || !sharedInput) return
  currentHandle.setValue(sharedInput.value || undefined)
  hideSharedInput()
}

function hideSharedInput() {
  if (sharedInput) {
    sharedInput.style.display = 'none'
  }
  currentHandle = null
  unsubscribeCoord?.()
  unsubscribeCoord = null
}

export function dispose() {
  sharedInput?.remove()
  sharedInput = null
  currentHandle = null
  unsubscribeCoord?.()
  unsubscribeCoord = null
}

function startEdit(handle: NodeHandle, valueText: Konva.Text) {
  const input = getSharedInput()

  if (!positionOverlay(input, valueText, valueText.width(), INPUT_HEIGHT)) return

  input.value = String(handle.getRealValue() ?? '')

  currentHandle = handle
  unsubscribeCoord?.()
  unsubscribeCoord = closeOverlayOnCoordChange(handle, () => input.blur())

  input.focus()
  input.select()
}

export const create: HandleModule['create'] = (handle) => {
  const group = new Konva.Group()
  const w = availableWidth(handle)

  const inputBg = new Konva.Rect({
    name: 'input-bg',
    width: w,
    height: INPUT_HEIGHT,
    fill: COLORS.BG,
    stroke: COLORS.BORDER,
    strokeWidth: 1,
    cornerRadius: 2,
  })
  group.add(inputBg)

  const valueText = new Konva.Text({
    name: 'value',
    text: String(handle.getValue() ?? ''),
    fontSize: 12,
    fill: COLORS.TEXT_PRIMARY,
    width: w,
    height: INPUT_HEIGHT,
    align: 'left',
    verticalAlign: 'middle',
    padding: 4,
  })
  group.add(valueText)

  inputBg.on('click', () => {
    startEdit(handle, valueText)
  })
  valueText.on('click', () => {
    startEdit(handle, valueText)
  })

  return group
}

export const update: HandleModule['update'] = (group, handle) => {
  const valueText = group.findOne<Konva.Text>('.value')
  if (valueText) {
    valueText.text(String(handle.getValue() ?? ''))
  }
}
