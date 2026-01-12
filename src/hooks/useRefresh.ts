import { ref } from 'vue'

export function useRefresh() {
  const count = ref(0)

  return {
    dirty() {
      count.value
    },
    trigger() {
      count.value++
    },
  }
}
