import { useEventListener, useMouse } from '@vueuse/core'
import { type MaybeRefOrGetter, toValue } from 'vue'
import { RectBox } from '../utils/RectBox'

export function useSelection(opt: {
  disabled?: MaybeRefOrGetter<boolean>
  onStart?(): void
  onMove?(rect: RectBox): void
  onEnd?(): void
}) {

  const state = {
    started: false,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
  }

  const areaEl = document.createElement('div')
  areaEl.style.border = '1px solid rgba(41, 136, 237, 1)'
  areaEl.style.background = 'rgba(41, 136, 237, 0.2)'

  const mouse = useMouse()

  useEventListener('pointerdown', () => {
    if (toValue(opt.disabled)) {
      return
    }

    start()
  })

  useEventListener('pointermove', () => {
    if (!state.started) {
      return
    }

    update()
  })

  useEventListener('pointerup', () => {
    if (!state.started) {
      return
    }

    end()
  })

  function updateAreaStyle() {
    areaEl.style.position = 'fixed'
    areaEl.style.left = '0px'
    areaEl.style.top = '0px'

    const x = Math.min(state.x1, state.x2)
    const y = Math.min(state.y1, state.y2)
    const w = Math.abs(state.x1 - state.x2)
    const h = Math.abs(state.y1 - state.y2)

    areaEl.style.width = w + 'px'
    areaEl.style.height = h + 'px'

    areaEl.style.translate = `${x}px ${y}px`
  }

  function start() {
    state.started = true

    state.x1 = mouse.x.value
    state.y1 = mouse.y.value

    state.x2 = mouse.x.value
    state.y2 = mouse.y.value

    updateAreaStyle()
    document.body.append(areaEl)
    opt.onStart?.()
  }

  function update() {
    state.x2 = mouse.x.value
    state.y2 = mouse.y.value

    const x = Math.min(state.x1, state.x2)
    const y = Math.min(state.y1, state.y2)
    const w = Math.abs(state.x1 - state.x2)
    const h = Math.abs(state.y1 - state.y2)

    updateAreaStyle()

    opt.onMove?.(new RectBox(x,y,w,h))
  }

  function end() {
    state.started = false
    areaEl.remove()

    opt.onEnd?.()
  }
}
