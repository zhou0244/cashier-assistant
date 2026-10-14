import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt', injectRegister: null,
    includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
    manifest: { name: 'Cashier Assistant', short_name: 'Cashier', description: 'Personal local product and verified code lookup', start_url: '/', scope: '/', display: 'standalone', background_color: '#f6f7f3', theme_color: '#173e36', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,webmanifest,woff2}'], navigateFallback: '/index.html', cleanupOutdatedCaches: true,
    },
    devOptions: { enabled: false },
  })],
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], clearMocks: true, restoreMocks: true },
});
