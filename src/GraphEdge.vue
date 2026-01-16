<script lang="ts" setup>
import { useMounted } from "@vueuse/core";
import { computed } from "vue";
import CubicBezier from "./CubicBezier.vue";
import { getHandleJointDom, getHandleJointDomPosition } from "./core/domHelper";
import { useEdge } from "./hooks";

export interface GraphEdgeProps {
  edgeId: number;
}

const props = defineProps<GraphEdgeProps>();

const edge = useEdge(() => props.edgeId);

const mounted = useMounted();

const pathProps = computed(() => {
  if (!mounted.value) {
    return false;
  }

  let startHandle = edge.value.start;
  let endHandle = edge.value.end;

  if (edge.value.start.isRight) {
    startHandle = edge.value.end;
    endHandle = edge.value.start;
  }

  const startDom = getHandleJointDom(startHandle);
  const endDom = getHandleJointDom(endHandle);

  if (!startDom || !endDom) {
    return false;
  }

  const start = getHandleJointDomPosition(startHandle);
  const end = getHandleJointDomPosition(endHandle);

  return {
    start: start,
    end: end,
  };
});
</script>

<template>
  <CubicBezier v-if="pathProps" v-bind="pathProps" :data-edge-id="edge.id" :data-start="`${edge.start.node.id}-${edge.start.key}`"
    :data-end="`${edge.end.node.id}-${edge.end.key}`" />
</template>

<style lang="less"></style>
