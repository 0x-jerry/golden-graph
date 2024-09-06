import { RRenderer, GNode, GHandle } from '@0x-jerry/golden-graph/src'

export function setup(rootEl: HTMLElement) {
  const renderer = new RRenderer({ x: 800, y: 600 })

  renderer.mount(rootEl)

  const n1 = new GNode()
  n1.addOutputHandle('output', new GHandle('number', { defaultValue: 0 }))

  n1.onProcess = async (t) => {
    t.setOutputValue('output', 100)
  }

  renderer.w.addNode(n1)

  const n2 = new GNode()
  n2.addInputHandle('input', new GHandle('number'))
  n2.addOutputHandle('output', new GHandle('string', { defaultValue: '' }))

  n2.onProcess = async (t) => {
    const s = await t.getInputValue<number>('input')
    t.setOutputValue('output', s?.toString())
  }

  renderer.w.addNode(n2)

  const n3 = new GNode()

  n3.addInputHandle('input', new GHandle('string'))

  n3.onProcess = async (t) => {
    const s = await t.getInputValue<string>('input')
    console.log(s)
  }

  renderer.w.connect(n1.getOutputHandle('output')!, n2.getInputHandle('input')!)
}
