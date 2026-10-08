import { describe, expect, it } from 'vitest'
import type Konva from 'konva'
import { ActiveType } from '@0x-jerry/golden-graph'
import { makeGroup, createWorkspace } from '../helpers/workspace'
import { makeStage } from '../helpers/stage'
import { find } from '../helpers/konva'
import { GroupView } from '../../src/renderer/GroupView'
import { InteractionManager } from '../../src/renderer/interaction/InteractionManager'

function setup() {
  const ws = createWorkspace()
  const group = makeGroup(ws, {
    pos: { x: 10, y: 20 },
    size: { x: 300, y: 200 },
  })
  const { stage, layer } = makeStage()
  const view = new GroupView(group)
  layer.add(view.group)

  const manager = new InteractionManager({ stage, ws })

  const setPointer = (pos: { x: number; y: number }) => {
    stage.setPointersPositions(
      new MouseEvent('pointermove', { clientX: pos.x, clientY: pos.y }),
    )
  }

  return {
    ws,
    group,
    body: find<Konva.Rect>(view.group, '.body'),
    header: find<Konva.Rect>(view.group, '.header'),
    title: find<Konva.Text>(view.group, '.name'),
    press(target: Konva.Node, pos = { x: 50, y: 60 }) {
      setPointer(pos)
      manager._onPointerDown({
        evt: { button: 0 },
        target,
      } as unknown as Konva.KonvaEventObject<PointerEvent>)
    },
    dragTo(pos: { x: number; y: number }) {
      setPointer(pos)
      manager._onPointerMove()
    },
  }
}

describe('group drag', () => {
  it('drags the group from the header band and the title text', () => {
    const fromHeader = setup()
    fromHeader.press(fromHeader.header, { x: 50, y: 20 })
    fromHeader.dragTo({ x: 150, y: 120 })
    expect(fromHeader.group.pos).toEqual({ x: 110, y: 120 })

    const fromTitle = setup()
    fromTitle.press(fromTitle.title, { x: 50, y: 20 })
    fromTitle.dragTo({ x: 150, y: 120 })
    expect(fromTitle.group.pos).toEqual({ x: 110, y: 120 })
  })

  it('selects the group from the body and pans the workspace instead of dragging it', () => {
    const { ws, group, body, press, dragTo } = setup()

    press(body, { x: 50, y: 150 })
    dragTo({ x: 250, y: 350 })

    expect(ws.state.activeType).toBe(ActiveType.Group)
    expect(ws.isActive(group.id)).toBe(true)
    expect(group.pos).toEqual({ x: 10, y: 20 })
    expect(ws.coord.origin).toEqual({ x: 200, y: 200 })
  })
})
