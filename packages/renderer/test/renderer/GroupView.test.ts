import { describe, it, expect } from 'vitest'
import type Konva from 'konva'
import { Group } from '@0x-jerry/golden-graph'
import { find } from '../helpers/konva'
import { GroupView } from '../../src/renderer/GroupView'
import { COLORS, RESIZE_HANDLE_SIZE } from '../../src/renderer/constants'

describe('GroupView', () => {
  it('syncs position/size/name and active stroke', () => {
    const group = new Group()
    group.id = 1
    group.setName('G')
    group.setSize({ x: 200, y: 100 })
    group.setPos({ x: 5, y: 5 })

    const view = new GroupView(group)
    view.update()

    expect(view.group.x()).toBe(5)
    expect(view.group.y()).toBe(5)
    expect(find<Konva.Text>(view.group, '.name').text()).toBe('G')
    expect(find<Konva.Rect>(view.group, '.body').width()).toBe(200)
  })

  it('toggles active group border', () => {
    const group = new Group()
    group.id = 2
    const view = new GroupView(group)
    const body = find<Konva.Rect>(view.group, '.body')

    view.setActive(true)
    expect(body.stroke()).toBe(COLORS.ACCENT)

    view.setActive(false)
    expect(body.stroke()).toBe(COLORS.GROUP_BORDER)
  })

  it('shows the resize grip only while selected and syncs its position', () => {
    const group = new Group()
    group.id = 3
    group.setSize({ x: 300, y: 200 })

    const view = new GroupView(group)
    const resize = find<Konva.Group>(view.group, '.resize')

    expect(resize.visible()).toBe(false)

    view.setActive(true)
    expect(resize.visible()).toBe(true)

    group.setSize({ x: 500, y: 400 })
    view.update()
    expect(resize.x()).toBe(500 - RESIZE_HANDLE_SIZE)
    expect(resize.y()).toBe(400 - RESIZE_HANDLE_SIZE)
  })

  it('opens a title editor on startRename and tears it down on stop', () => {
    const group = new Group()
    group.id = 4
    group.setName('G')
    const view = new GroupView(group)

    view.startRename()
    const input = view._nameInput
    expect(input).toBeDefined()
    expect(view._name.getChildren().includes(input!)).toBe(true)

    input!.deactivate()
    expect(view._nameInput).toBeNull()
    expect(view._name.getChildren().includes(input!)).toBe(false)
  })

  it('destroys an open title editor when the view is destroyed', () => {
    const group = new Group()
    group.id = 5
    const view = new GroupView(group)

    view.startRename()
    expect(view._nameInput).toBeDefined()

    view.destroy()
    expect(view._nameInput).toBeNull()
  })
})
