<script setup lang="ts">
import { chooseFiles } from '@0x-jerry/vue-kit'
import type { INodeHandleConfigOptions } from '../core'
import { useNodeHandle } from '../hooks'
import { useHandleOptions } from './useHandleOptions'

export interface ImageHandleOptions extends INodeHandleConfigOptions {
  accept?: string
  placeholder?: string
}

const options = useHandleOptions<ImageHandleOptions>()
const handle = useNodeHandle()!

async function onChooseImage() {
  const files = await chooseFiles()
  const file = files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    handle.value.setValue(reader.result as string)
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="handle-content">
    <template v-if="handle.getValue()">
      <img :src="handle.getValue() as string" class="handle-image" />
      <button class="handle-choose-btn" @click="onChooseImage">
        Change
      </button>
    </template>
    <div v-else class="handle-placeholder" @click="onChooseImage">
      {{ options.placeholder ?? 'Click to choose image' }}
    </div>
  </div>
</template>

<style scoped>
.handle-content {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 4px;
}

.handle-image {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  cursor: pointer;
}

.handle-placeholder {
  color: var(--gr-color-text-muted, #666);
  font-size: 12px;
  cursor: pointer;
  padding: 8px;
  border: 1px dashed var(--gr-color-border, #ccc);
  border-radius: 4px;
  width: 100%;
  text-align: center;
}

.handle-placeholder:hover {
  border-color: var(--gr-color-primary, #4a9eff);
  color: var(--gr-color-primary, #4a9eff);
}

.handle-choose-btn {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid var(--gr-color-border, #ccc);
  border-radius: 3px;
  background: transparent;
  color: var(--gr-color-text-muted, #666);
  cursor: pointer;
}

.handle-choose-btn:hover {
  border-color: var(--gr-color-primary, #4a9eff);
  color: var(--gr-color-primary, #4a9eff);
}
</style>
