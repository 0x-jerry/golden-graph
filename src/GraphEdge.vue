<script lang="ts" setup>
import { computed } from "vue";
import CubicBezier from "./CubicBezier.vue";
import { useEdge } from "./hooks/useEdge";
import { useMounted } from "@vueuse/core";

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

  if (edge.value.start.isOutput) {
    startHandle = edge.value.end;
    endHandle = edge.value.start;
  }

  const startNode = startHandle.node;
  const endNode = endHandle.node;

  const startDom = startHandle.getJointDom();
  const endDom = endHandle.getJointDom();

  if (!startDom || !endDom) {
    return false;
  }

  const s = {
    x: startNode.pos.x + startDom.offsetLeft + startDom.clientWidth / 2,
    y: startNode.pos.y + startDom.offsetTop + startDom.clientHeight / 2,
  };

  const e = {
    x: endNode.pos.x + endDom.offsetLeft + endDom.clientWidth / 2,
    y: endNode.pos.y + endDom.offsetTop + endDom.clientHeight / 2,
  };

  return {
    start: {
      x: s.x,
      y: s.y,
    },
    end: {
      x: e.x,
      y: e.y,
    },
  };
});
</script>

<template>
  <CubicBezier v-if="pathProps" v-bind="pathProps" />
</template>

<style lang="less"></style>
