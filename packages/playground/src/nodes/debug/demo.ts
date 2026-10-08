import { HandlePosition } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import { toTslCode } from '../tsl/code'

const OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: `vec3(${(i / 24).toFixed(3)}, ${((i % 6) / 6).toFixed(3)}, ${((i % 4) / 4).toFixed(3)})`,
  label: `Palette stop ${i + 1} — a deliberately long option label that overflows the dropdown`,
}))

const DEFAULT = OPTIONS[0]!.value

/** Debug node for exercising the select widget: many options, long labels. */
export const selectDemoDefinition: INodeDefinition = {
  schema: {
    name: 'Select',
    description: '24 long options — scroll the list, watch labels clip',
    handles: [
      {
        key: 'options',
        name: 'Options',
        value: DEFAULT,
        type: 'select',
        options: { options: OPTIONS },
      },
      {
        key: 'value',
        name: 'Value',
        position: HandlePosition.Right,
        accepts: ['vec3', 'vec4'],
        value: DEFAULT,
      },
    ],
  },
  execute: (ctx) => {
    ctx.setData('value', toTslCode(ctx.getData('options')))
  },
}

/** Debug node for exercising the slider widget and its value-box toggle. */
export const rangeDemoDefinition: INodeDefinition = {
  schema: {
    name: 'Range',
    description: 'Slider handle — drag, click the track, or type a value',
    handles: [
      {
        key: 'value',
        name: 'Amount',
        value: 50,
        type: 'range',
        options: { min: 0, max: 100, step: 1 },
      },
      {
        key: 'plain',
        name: 'No value box',
        value: 0.5,
        type: 'range',
        options: { min: -1, max: 1, step: 0.05, showEditableValue: false },
      },
      {
        key: 'out',
        name: 'Value',
        position: HandlePosition.Right,
        accepts: 'float',
        value: 50,
      },
    ],
  },
  execute: (ctx) => {
    ctx.setData('out', toTslCode(ctx.getData('value')))
  },
}

const TEXT = [
  'A multiline textarea soft-wraps long lines and scrolls vertically.',
  'Enter adds a newline; Escape or clicking away commits.',
  'The box is a fixed three lines tall, so taller content scrolls.',
  'Hover the box to reveal the scrollbar and drag its thumb.',
].join('\n')

/** Debug node for exercising the multiline textarea widget. */
export const textareaDemoDefinition: INodeDefinition = {
  schema: {
    name: 'Textarea',
    description: 'Multiline textarea + value output',
    handles: [
      {
        key: 'text',
        name: 'Text',
        value: TEXT,
        type: 'textarea',
      },
      {
        key: 'value',
        name: 'Value',
        position: HandlePosition.Right,
        value: TEXT,
      },
    ],
  },
  execute: (ctx) => {
    ctx.setData('value', String(ctx.getData('text') ?? ''))
  },
}

/** Debug node for exercising the read-only, scrollable display handle. */
export const displayDemoDefinition: INodeDefinition = {
  schema: {
    name: 'Display',
    description: 'Read-only scrollable text input',
    handles: [
      {
        key: 'value',
        name: 'Value',
        position: HandlePosition.Left,
        type: 'display',
        value: `${TEXT}\n${TEXT}`,
      },
    ],
  },
}
