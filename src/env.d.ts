// Secrets não aparecem no wrangler.jsonc, então não entram no worker-configuration.d.ts
// gerado pelo `wrangler types`. Declaramos aqui pra tipar o binding em todo o app.
declare namespace Cloudflare {
  interface Env {
    // Protege os endpoints internos de populate/sync manuais.
    ADMIN_SECRET: string;
  }
}

// Usuário anônimo resolvido pelo middleware a partir do cookie (null se não houver).
declare namespace App {
  interface Locals {
    user: import('./db/schema').User | null;
  }
}
