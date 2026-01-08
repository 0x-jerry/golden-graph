import { GNode, GHandle, GWorksapce, GHandleType } from '../../src'

export function setup() {
  const $w = new GWorksapce()

  const n1 = buildNodeNumberInput()

  n1.move(100, 100)

  $w.addNode(n1)

  const n2 = buildNodeToString()

  n2.move(200, 200)

  $w.addNode(n2)

  $w.connect(n1.getOutputHandle('output')!, n2.getInputHandle('input')!)

  return $w
}

function buildNodeNumberInput() {
  const node = new GNode()
  node.title = 'Number'

  node.addOutputHandle(
    'output',
    new GHandle('number', { defaultValue: 0, type: GHandleType.Output })
  )

  node.onProcess = async (t) => {
    t.setOutputValue('output', 100)
  }

  return node
}

function buildNodeToString() {
  const node = new GNode()
  node.title = 'ToString'

  node.addInputHandle('input', new GHandle('number', { type: GHandleType.Input }))

  node.addOutputHandle(
    'output',
    new GHandle('text', { defaultValue: '', type: GHandleType.Output })
  )

  node.onProcess = async (t) => {
    const s = await t.getInputValue<number>('input')
    t.setOutputValue('output', s?.toString())
  }

  return node
}
