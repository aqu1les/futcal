// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // O adapter v14 carrega os bindings do wrangler.jsonc (DB/D1) automaticamente no `astro dev`.
  adapter: cloudflare(),
  integrations: [vue()],

  vite: {
    plugins: [tailwindcss()],
  },
});
