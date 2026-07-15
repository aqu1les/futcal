/// <reference types="@cloudflare/vitest-pool-workers" />
import type { D1Migration } from '@cloudflare/vitest-pool-workers/config';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Cloudflare.Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}
