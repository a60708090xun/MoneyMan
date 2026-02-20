import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/MoneyMan/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MoneyMan',
        short_name: 'MoneyMan',
        description: '跨平台記帳 App，信用卡回饋追蹤與智慧推薦',
        theme_color: '#4CAF50',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/MoneyMan/',
        icons: [
          { src: '/MoneyMan/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/MoneyMan/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  optimizeDeps: {
    exclude: ['sql.js']
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js']
  }
})
