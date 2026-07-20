import Konva from 'konva'
import type { NodeHandle } from '../../core'
import { COLORS } from '../constants'
import { closeOverlayOnCoordChange, positionOverlay } from './overlay'
import type { HandleModule } from './types'

export const type = 'select'

const INPUT_WIDTH = 64
const INPUT_HEIGHT = 18

let sharedSelect: HTMLSelectElement | null = null
let currentHandle: NodeHandle | null = null
let unsubscribeCoord: (() => void) | null = null

function getSharedSelect(): HTMLSelectElement {
  if (!sharedSelect) {
    sharedSelect = document.createElement('select')
    sharedSelect.style.cssText = `
      position: fixed;
      font-size: 12px;
      padding: 0 4px;
      border: 1px solid ${COLORS.ACCENT};
      outline: none;
      box-sizing: border-box;
      z-index: 9999;
      display: none;
      background: white;
    `
    document.body.appendChild(sharedSelect)

    sharedSelect.addEventListener('blur', finishEdit)
    sharedSelect.addEventListener('change', () => {
      sharedSelect!.blur()
    })
    sharedSelect.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (currentHandle) {
          sharedSelect!.value = String(currentHandle.getRealValue() ?? '')
        }
        sharedSelect!.blur()
      }
    })
  }
  return sharedSelect
}

function finishEdit() {
  if (!currentHandle || !sharedSelect) return
  currentHandle.setValue(sharedSelect.value)
  hideSharedSelect()
}

function hideSharedSelect() {
  if (sharedSelect) {
    sharedSelect.style.display = 'none'
  }
  currentHandle = null
  unsubscribeCoord?.()
  unsubscribeCoord = null
}

export function dispose() {
  sharedSelect?.remove()
  sharedSelect = null
  currentHandle = null
  unsubscribeCoord?.()
  unsubscribeCoord = null
}

function startEdit(handle: NodeHandle, valueText: Konva.Text) {
  const select = getSharedSelect()

  if (!positionOverlay(select, valueText, INPUT_WIDTH, INPUT_HEIGHT)) return

  const options = handle.getOptions<{ type: string, options?: Array<{ value: string, label: string }> | string[] }>()
  select.innerHTML = ''

  if (options.options) {
    for (const opt of options.options) {
      const option = document.createElement('option')
      if (typeof opt === 'string') {
        option.value = opt
        option.textContent = opt
      } else {
        option.value = opt.value
        option.textContent = opt.label
      }
      select.appendChild(option)
    }
  }

  select.value = String(handle.getRealValue() ?? '')

  currentHandle = handle
  unsubscribeCoord?.()
  unsubscribeCoord = closeOverlayOnCoordChange(handle, () => select.blur())

  select.focus()
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
