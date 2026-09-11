import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'protocol',
    globals: true,
    environment: 'edge-runtime',
    // reuse env per worker; keeps per-file isolation
    pool: 'vmThreads',
  },
})
