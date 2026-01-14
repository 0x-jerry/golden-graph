import { describe, it, expect } from 'vitest'
import DefaultHandle from '../../src/handles/DefaultHandle.vue'
import DisplayHandle from '../../src/handles/DisplayHandle.vue'
import NumberHandle from '../../src/handles/NumberHandle.vue'
import TextHandle from '../../src/handles/TextHandle.vue'
import { getHandleComponent } from '../../src/handles'

describe('handles getHandleComponent', () => {
  it('returns mapped components', () => {
    expect(getHandleComponent('text')).toBe(TextHandle)
    expect(getHandleComponent('number')).toBe(NumberHandle)
    expect(getHandleComponent('display')).toBe(DisplayHandle)
  })

  it('falls back to default', () => {
    expect(getHandleComponent('unknown')).toBe(DefaultHandle)
  })
})

