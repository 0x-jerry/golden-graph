import Konva from 'konva'
import type { NodeHandle } from '../../core'
import { COLORS } from '../constants'
import type { HandleModule } from './types'

export const type = 'text'

const INPUT_WIDTH = 80
const INPUT_HEIGHT = 18

let sharedInput: HTMLInputElement | null = null
let currentHandle: NodeHandle | null = null

function getSharedInput(): HTMLInputElement {
  if (!sharedInput) {
    sharedInput = document.createElement('input')
    sharedInput.type = 'text'
    sharedInput.style.cssText = `
      position: fixed;
      font-size: 12px;
      padding: 0 4px;
      border: 1px solid ${COLORS.ACCENT};
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
}

function startEdit(handle: NodeHandle, valueText: Konva.Text) {
  const input = getSharedInput()
  const stage = valueText.getStage()
  if (!stage) return

  const container = stage.container()
  const absPos = valueText.getAbsolutePosition()
  const scale = stage.scaleX()
  const rect = container.getBoundingClientRect()

  const x = rect.left + absPos.x * scale - 2 * scale
  const y = rect.top + absPos.y * scale - 2 * scale
  const width = INPUT_WIDTH * scale + 4
  const height = INPUT_HEIGHT * scale + 2

  input.style.left = `${x}px`
  input.style.top = `${y}px`
  input.style.width = `${width}px`
  input.style.height = `${height}px`
  input.style.fontSize = `${12 * scale}px`
  input.style.display = 'block'
  input.value = String(handle.getRealValue() ?? '')

  currentHandle = handle

  input.focus()
  input.select()
}

export const create: HandleModule['create'] = (handle) => {
  const group = new Konva.Group()

  const inputBg = new Konva.Rect({
    name: 'input-bg',
    width: INPUT_WIDTH,
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
    width: INPUT_WIDTH,
    height: INPUT_HEIGHT,
    align: 'center',
    verticalAlign: 'middle',
  })
  group.add(valueText)

  const labelText = new Konva.Text({
    name: 'label',
    text: handle.name,
    fontSize: 12,
    fill: COLORS.TEXT_MUTED,
    x: INPUT_WIDTH + 6,
    verticalAlign: 'middle',
  })
  group.add(labelText)

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
