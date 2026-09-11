import vue from '@vitejs/plugin-vue'
import { defineProject } from 'vitest/config'

export default defineProject({
  plugins: [vue()],
  test: {
    name: 'renderer',
    globals: true,
    environment: 'jsdom',
    // reuse the jsdom environment per worker (native `canvas` still loads
    // fine here); keeps per-file isolation, unlike `isolate: false`
    pool: 'vmThreads',
    setupFiles: ['./test/setup.ts'],
  },
})
