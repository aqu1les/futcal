import { handle } from '@astrojs/cloudflare/handler';
import { getDb } from './db';
import { populateTeams } from './lib/populate';
import { syncFixtures } from './lib/sync';
import { provider } from './providers';

// Cron anual do populate de times (ver wrangler.jsonc). O resto dos crons é sync.
const POPULATE_CRON = '0 8 1 2 *';

// Entry custom do Worker: delega o fetch pro handler do Astro e trata os Cron
// Triggers — populate anual dos times e varredura diária dos jogos.
export default {
  fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    const db = getDb(env);

    if (event.cron === POPULATE_CRON) {
      ctx.waitUntil(
        populateTeams(db, provider).then((s) =>
          console.log('[cron] populate', provider.source, s),
        ),
      );
    } else {
      ctx.waitUntil(
        syncFixtures(db, provider).then((s) =>
          console.log('[cron] sync', provider.source, s),
        ),
      );
    }
  },
} satisfies ExportedHandler<Cloudflare.Env>;
