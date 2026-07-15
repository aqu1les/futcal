import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

// Testes rodam dentro do workerd (mesmo runtime da produção), com D1 real em memória.
export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
      },
    },
  },
});
