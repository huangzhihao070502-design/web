import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // @ts-ignore
      input: 'index.html',
    },
  },
  // Force WASM rollup on Android
  resolve: {
    alias: {
      '@rollup/rollup-android-arm64': '@rollup/wasm-node',
    },
  },
})
