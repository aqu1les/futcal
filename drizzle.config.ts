import { defineConfig } from 'drizzle-kit';

// Migrations vão pra ./drizzle/migrations (mesmo path do migrations_dir no wrangler.jsonc),
// aplicadas via `wrangler d1 migrations apply futcal --local|--remote`.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
});
