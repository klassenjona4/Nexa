import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// The API runs as Vercel functions in production. In development `npm run dev:api` serves the
// same Hono app on port 8787 and Vite proxies to it.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // A new version takes over at once (skipWaiting, clientsClaim). The app registers the service
      // worker itself (src/lib/appUpdate.ts) and reloads onto it when nothing can be lost.
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Nexa',
        short_name: 'Nexa',
        description: 'Plan a group assignment and record who did each part.',
        lang: 'en-IE',
        start_url: '/projects',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#FFFFFF',
        background_color: '#F7F7F5',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only: HTML, scripts, styles, fonts and icons built by Vite.
        // No runtime caching, so API responses, Supabase data and files are never stored.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
        // The PDF export library loads on demand only.
        globIgnores: ['**/statementPdf-*.js'],
        runtimeCaching: [],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
        cleanupOutdatedCaches: true,
        // Set explicitly: the plugin only adds these itself when it injects its own register script.
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    sourcemap: false,
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
  },
});
