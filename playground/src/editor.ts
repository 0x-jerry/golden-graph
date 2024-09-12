import {
  RRenderer,
  GNode,
  GHandle,
  GWorksapce,
  GHandlePosition
} from '../../src'

export function setup(rootEl: HTMLElement) {
  const $w = new GWorksapce()

  const n1 = new GNode()
  n1.addOutputHandle(
    'output',
    new GHandle('number', { defaultValue: 0, type: GHandlePosition.Right })
  )

  n1.onProcess = async (t) => {
    t.setOutputValue('output', 100)
  }

  $w.addNode(n1)

  const n2 = new GNode()
  n2.addInputHandle(
    'input',
    new GHandle('number', { type: GHandlePosition.Left })
  )
  n2.addOutputHandle(
    'output',
    new GHandle('text', { defaultValue: '', type: GHandlePosition.Right })
  )

  n2.onProcess = async (t) => {
    const s = await t.getInputValue<number>('input')
    t.setOutputValue('output', s?.toString())
  }

  $w.addNode(n2)

  const n3 = new GNode()

  n3.addInputHandle(
    'input',
    new GHandle('text', { type: GHandlePosition.Left })
  )

  n3.onProcess = async (t) => {
    const s = await t.getInputValue<string>('input')
    console.log(s)
  }

  $w.connect(n1.getOutputHandle('output')!, n2.getInputHandle('input')!)
  //  -----------
  const renderer = new RRenderer($w)

  renderer.mount(rootEl)
}
