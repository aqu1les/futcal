// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import vue from '@astrojs/vue';
import AstroPWA from '@vite-pwa/astro';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // O adapter v14 carrega os bindings do wrangler.jsonc (DB/D1) automaticamente no `astro dev`.
  adapter: cloudflare(),
  integrations: [
    vue(),
    AstroPWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // O feed e a API NUNCA são cacheados pelo service worker (dados por-usuário/dinâmicos).
      workbox: {
        navigateFallback: null,
        globPatterns: ['**/*.{js,css,svg,png,ico,webp,woff2}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/cal\//],
      },
      manifest: {
        name: 'FutCal — jogos dos seus times',
        short_name: 'FutCal',
        description:
          'Calendário assinável com os jogos dos times que você segue.',
        lang: 'pt-BR',
        theme_color: '#0b1f17',
        background_color: '#0b1f17',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
