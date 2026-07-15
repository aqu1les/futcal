import {
  defineWorkersConfig,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers/config';

// Lê as migrations Drizzle e as injeta como binding pra aplicar no D1 em memória dos testes.
const migrations = await readD1Migrations('./drizzle/migrations');

// Testes rodam dentro do workerd (mesmo runtime da produção), com D1 real em memória.
export default defineWorkersConfig({
  test: {
    setupFiles: ['./tests/apply-migrations.ts'],
    poolOptions: {
      workers: {
        // main de teste próprio: os testes exercitam o código via `env`/D1 e imports
        // diretos, sem depender do build do adapter Astro (que só resolve no `astro build`).
        main: './tests/worker-entry.ts',
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      },
    },
  },
});
