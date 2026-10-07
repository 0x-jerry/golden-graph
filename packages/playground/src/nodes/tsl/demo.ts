import { HandlePosition } from '@0x-jerry/golden-graph'
import type { INodeDefinition } from '@0x-jerry/golden-graph-backend'
import { toTslCode } from './code'

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
        key: 'stop',
        name: 'Stop',
        value: DEFAULT,
        type: 'select',
        options: { options: OPTIONS },
      },
      {
        key: 'out',
        name: 'Color',
        position: HandlePosition.Right,
        accepts: ['vec3', 'vec4'],
        value: DEFAULT,
      },
    ],
  },
  execute: (ctx) => {
    ctx.setData('out', toTslCode(ctx.getData('stop')))
  },
}
