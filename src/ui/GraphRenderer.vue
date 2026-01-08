<script setup lang="ts">
import type { GWorksapce } from '../core'

export interface GraphRendererProps {
  workspace: GWorksapce
}

defineProps<GraphRendererProps>()
</script>

<template>
  <div class="r-renderer"></div>
</template>

<style lang="less"></style>
