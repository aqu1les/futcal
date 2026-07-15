// Secrets não aparecem no wrangler.jsonc, então não entram no worker-configuration.d.ts
// gerado pelo `wrangler types`. Declaramos aqui pra tipar o binding em todo o app.
declare namespace Cloudflare {
  interface Env {
    API_FOOTBALL_KEY: string;
  }
}
