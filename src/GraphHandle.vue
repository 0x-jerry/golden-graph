<script lang="ts" setup>
import { useElementHover } from "@vueuse/core";
import { computed, useTemplateRef } from "vue";
import { getHandleComponent } from "./handles";
import { useConnectionGesture, useNodeHandle } from "./hooks";

export interface GraphHandleProps {
  handleKey: string;
}

const props = defineProps<GraphHandleProps>();

const handle = useNodeHandle.provide(() => props.handleKey);

const gesture = useConnectionGesture()!

const jointEl = useTemplateRef('joint-el')

const isHovering = useElementHover(jointEl)

const jointProps = computed(() => {
  const props = {
    class: ['r-joint'],
    role: 'handle-joint',
    onPointerdown: () => gesture.startConnection(handle.value),
    onPointerup: () => gesture.endConnection(handle.value),
  }

  updateClasses()

  return props

  function updateClasses() {
    const { isConnectingHandle, handle: gHandle } = gesture.state

    if (!isConnectingHandle || !gHandle || gHandle === handle.value) {
      return
    }

    if (!handle.value.canConnectTo(gHandle)) {
      props.class.push('r-joint-fade')

      return
    }

    if (isHovering.value) {
      props.class.push('r-joint-ring')
    }
  }
})

const options = computed(() => handle.value.getOptions())

const ContentComponent = computed(() => getHandleComponent(options.value.type))
</script>

<template>
  <div class="r-handle" :class="[{ 'is-output': handle.isRight }]" :handle-key="handle.key">
    <div ref="joint-el" v-if="!handle.isNone" v-bind="jointProps" />

    <div class="r-handle-content">
      <component v-if="ContentComponent" :is="ContentComponent" v-bind="options" />
    </div>
  </div>
</template>

<style lang="less">
.r-joint {
  position: relative;
  --size: var(--gr-size-handle-joint, 10px);

  left: calc(-1 * var(--size) / 2);

  width: var(--size);
  height: var(--size);
  border-radius: var(--size);

  background: var(--gr-color-accent, red);

  pointer-events: auto;
}

.r-joint-fade {
  opacity: 0.3;
}

.r-joint-ring {
  box-shadow: 0 0 10px 2px var(--gr-color-accent, red);
}

.r-handle-content {
  display: flex;
  align-items: center;
  flex: 1;
  width: 0;
}

.r-handle {
  display: flex;
  align-items: center;
  gap: 4px;

  min-height: 26px;

  &.is-output {
    flex-direction: row-reverse;

    .r-joint {
      left: unset;
      right: calc(-1 * var(--size) / 2);
    }

    .r-handle-content {
      justify-content: flex-end;
    }
  }
}
</style>
