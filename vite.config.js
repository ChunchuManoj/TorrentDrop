import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'events', 'path', 'process', 'stream', 'string_decoder', 'util'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
