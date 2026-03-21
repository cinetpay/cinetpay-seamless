import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'CinetPaySeamless',
      fileName: 'cinetpay-seamless',
      formats: ['es', 'umd'],
    },
    cssFileName: 'cinetpay-seamless',
    minify: 'esbuild',
    sourcemap: true,
  },
})
