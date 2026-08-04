import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import pkg from './package.json'

export default defineConfig({
  build: {
    lib: {
      entry: ['./src/index.ts'],
      formats: ['es'],
    },
    rollupOptions: {
      external: Object.keys(pkg.dependencies),
    },
  },
  plugins: [
    vue(),
    Icons({ compiler: 'vue3' }),
    dts({
      exclude: ['*.ts', 'test', 'playground'],
    }),
  ],
})
