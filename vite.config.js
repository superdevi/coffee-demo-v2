import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        latteArt: resolve(__dirname, 'games/latte-art/index.html'),
        tapTap: resolve(__dirname, 'games/tap-tap/index.html'),
        cupStack: resolve(__dirname, 'games/cup-stack/index.html'),
      },
    },
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
  },
})
