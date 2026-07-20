import Konva from 'konva'
import type { NodeHandle } from '../../core'
import { COLORS } from '../constants'
import type { HandleModule } from './types'

export const type = 'select'

const INPUT_WIDTH = 64
const INPUT_HEIGHT = 18

let sharedSelect: HTMLSelectElement | null = null
let currentHandle: NodeHandle | null = null

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
}

function startEdit(handle: NodeHandle, valueText: Konva.Text) {
  const select = getSharedSelect()
  const stage = valueText.getStage()
  if (!stage) return

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

  const container = stage.container()
  const absPos = valueText.getAbsolutePosition()
  const scale = stage.scaleX()
  const rect = container.getBoundingClientRect()

  const x = rect.left + absPos.x * scale - 2 * scale
  const y = rect.top + absPos.y * scale - 2 * scale
  const width = INPUT_WIDTH * scale + 4
  const height = INPUT_HEIGHT * scale + 2

  select.style.left = `${x}px`
  select.style.top = `${y}px`
  select.style.width = `${width}px`
  select.style.height = `${height}px`
  select.style.fontSize = `${12 * scale}px`
  select.style.display = 'block'

  currentHandle = handle

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
