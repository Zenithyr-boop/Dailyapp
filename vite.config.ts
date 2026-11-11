import { defineConfig, type Plugin } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { privacyPolicyHtml } from './src/features/legal/policyHtml.ts'

/** package.json's version: shown in Me → About and compared with GitHub Releases (lib/updates.ts). */
const APP_VERSION = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version

/**
 * `privacypolicy.html`: the privacy policy as a script-free page (src/features/legal).
 * Health Connect's permission screen opens it from the APK; the website serves it too.
 */
function privacyPolicyPage(): Plugin {
  const fileName = 'privacypolicy.html'
  return {
    name: 'fromzero-privacy-policy',
    configureServer(server) {
      server.middlewares.use(`/${fileName}`, (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(privacyPolicyHtml())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName, source: privacyPolicyHtml() })
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    tailwindcss(),
    privacyPolicyPage(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered in main.tsx, and only on the website: the Android app has no service worker.
      injectRegister: false,
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
        // A real page, not an app route.
        navigateFallbackDenylist: [/privacypolicy/],
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
