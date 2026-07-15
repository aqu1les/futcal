import { handle } from '@astrojs/cloudflare/handler';
import { syncFixtures } from './lib/sync';

// Entry custom do Worker: delega o fetch pro handler do Astro e adiciona o
// handler `scheduled` do Cron Trigger (sync diário dos fixtures).
export default {
  fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      syncFixtures(env).then((summary) => {
        console.log('[cron] sync diário concluído', summary);
      }),
    );
  },
} satisfies ExportedHandler<Cloudflare.Env>;
