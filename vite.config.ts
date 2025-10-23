// vite.config.ts
import { defineConfig } from 'vite'
import webExtension from 'vite-plugin-web-extension'

export default defineConfig({
  plugins: [
    webExtension({
      manifest: './src/manifest.json'
    })
  ],
  build: {
    outDir: 'eons-dev-launcher',
  }
})
