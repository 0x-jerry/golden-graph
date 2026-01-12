<script lang="ts" setup>
import { computed } from "vue";
import type { IVec2 } from "./core";

export interface CubicBezierProps {
  start: IVec2;
  end: IVec2;
}

const props = defineProps<CubicBezierProps>();

const d = computed(() => {
  const { start, end } = props;

  const s = {
    x: start.x,
    y: start.y,
  };

  const e = {
    x: end.x,
    y: end.y,
  };

  const handleOffset = 150;

  return `M ${s.x} ${s.y} C ${s.x - handleOffset} ${s.y}, ${
    e.x + handleOffset
  } ${e.y}, ${e.x} ${e.y}`;
});
</script>

<template>
  <path class="curve-path" :d="d"></path>
</template>

<style lang="less" scoped>
.curve-path {
  stroke: rgb(239, 70, 70);
  stroke-width: 3px;
  fill: transparent;
}
</style>
