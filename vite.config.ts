import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icono.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg}'], maximumFileSizeToCacheInBytes: 5_000_000 },
      manifest: {
        name: 'Calculadora RIC',
        short_name: 'Calc RIC',
        description: 'Proyectos eléctricos según Pliegos Técnicos RIC (SEC Chile)',
        lang: 'es-CL',
        theme_color: '#1e3a8a',
        background_color: '#f3f5f9',
        display: 'standalone',
        icons: [{ src: 'icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  test: { environment: 'node' },
});
