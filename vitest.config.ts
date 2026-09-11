import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // One project per package; each keeps its own vitest.config.ts
    // (defineProject). playground has no tests, so it is excluded.
    // A package config may itself declare `projects` (nested projects):
    // it then only provides sub-projects named "<pkg> (<sub>)" and runs
    // no tests of its own — see https://vitest.dev/guide/projects.html#nested-projects
    projects: ['packages/!(playground)'],
    // persist Vite transforms across runs/processes (cache dir lives in the
    // root node_modules, so reinstalling deps invalidates it). Clear with
    // `bunx vitest --clearCache`.
    fsModuleCache: true,
    // coverage is a root-only option (not supported in project configs)
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/*.test.ts'],
      reporter: ['clover', 'html'],
    },
  },
})
