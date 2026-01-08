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
    new GHandle({
      id: 'output',
      type: 'number',
      name: 'Output',
      defaultValue: 0,
      handleType: GHandleType.Output,
    })
  )

  node.onProcess = async (t) => {
    t.setOutputValue('output', 100)
  }

  return node
}

function buildNodeToString() {
  const node = new GNode()
  node.title = 'ToString'

  node.addInputHandle(
    new GHandle({
      id: 'input',
      name: 'Number',
      type: 'number',
      handleType: GHandleType.Input,
    })
  )

  node.addOutputHandle(
    new GHandle({
      id: 'output',
      name: 'String',
      type: 'string',
      defaultValue: '',
      handleType: GHandleType.Output,
    })
  )

  node.onProcess = async (t) => {
    const s = await t.getInputValue<number>('input')
    t.setOutputValue('output', s?.toString())
  }

  return node
}
