import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'FromZero',
        short_name: 'FromZero',
        description: 'Free fitness & discipline tracker',
        theme_color: '#0B0E14',
        background_color: '#0B0E14',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // The movement library (exercises.json) is its own JS chunk, so it's precached here too.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            // Movement photos: fetched only when a movement is opened, then kept for offline use.
            // Requested with CORS (crossOrigin on the <img>) so the cache stores real, small responses.
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/.+\.jpg$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'movement-photos',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Other sessions' git worktrees live under .claude/; only test this checkout.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
