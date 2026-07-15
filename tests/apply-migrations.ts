import { applyD1Migrations, env } from 'cloudflare:test';

// Aplica as migrations Drizzle no D1 em memória antes de cada arquivo de teste.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
