import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,bin}'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15MB to allow caching ai_models
        runtimeCaching: [
          {
            urlPattern: /^\/ai_models\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ai-models-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: 'ADCC Biometric',
        short_name: 'ADCC',
        description: 'Plataforma Elite de Gestión Deportiva Biométrica',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'Applogo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'Applogo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    host: true, // Listen on all addresses (0.0.0.0)
    allowedHosts: true, // Allow any host (needed for tunneling)
    port: 3000,
    proxy: {
      '/api-adcc': {
        target: 'https://adccanning.com.ar',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-adcc/, ''),
        headers: {
          'Referer': 'https://adccanning.com.ar/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    }
  }
})
