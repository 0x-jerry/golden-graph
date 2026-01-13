<script setup lang="ts">
import { computed } from 'vue';
import { useNodeHandle } from '../hooks/useNodeHandle';

const handle = useNodeHandle()!;

const value = computed({
    get() {
        return handle.value.getValue()
    },
    set(value) {
        handle.value.setValue(value)
    }
})
</script>
<template>
    <div>
        {{ value }}
    </div>
</template>