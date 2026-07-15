# FutCal ⚽

Calendário assinável (`.ics`) com os jogos dos times que você segue, sincronizado
1×/dia com a API-Football. Roda 100% no free tier da Cloudflare: um único Worker
serve o front (Astro + Vue islands), a API, o feed `.ics` e o cron de sync. Banco
em D1 (SQLite) com Drizzle.

## Stack

- **Astro** (adapter `@astrojs/cloudflare`, output `server`) + **Vue 3** em islands
- **D1** + **Drizzle ORM**
- **Cron Trigger** nativo (1×/dia) → handler `scheduled` em [src/worker.ts](src/worker.ts)
- Testes em **Vitest** com `@cloudflare/vitest-pool-workers` (rodam dentro do workerd)
- Runtime é o **workerd** — só Web APIs no código da aplicação, nunca APIs do Bun

## Desenvolvimento

```sh
bun install
bun run db:migrate:local      # aplica migrations no D1 local
bun run dev                   # front + endpoints (astro dev)
```

Para exercitar o Worker real (feed, cron, cookies) use a config gerada pelo build:

```sh
bun run build
bunx wrangler dev -c dist/server/wrangler.json
# cron local:  curl "http://localhost:8787/cdn-cgi/handler/scheduled"
```

## Comandos

| Comando | Ação |
| :-- | :-- |
| `bun run dev` | Dev server (Astro) em `localhost:4321` |
| `bun run build` | Build de produção |
| `bun run check` | Typecheck (`astro check`) |
| `bun run test` | Testes (Vitest no workerd) |
| `bun run db:generate` | Gera migration a partir do schema Drizzle |
| `bun run db:migrate:local` / `:remote` | Aplica migrations no D1 |
| `bun run deploy` | Build + `wrangler deploy` (config do adapter) |
| `bun run deploy:dry` | Build + deploy dry-run (não sobe nada) |

## Variáveis / bindings

```text
API_FOOTBALL_KEY     # secret  → bunx wrangler secret put API_FOOTBALL_KEY
API_FOOTBALL_SEASON  # var     → wrangler.jsonc (ex: 2026)
DB                   # binding D1
```

Para dev local com sync/busca reais, crie um `.dev.vars` (não versionado):

```text
API_FOOTBALL_KEY=sua-chave-aqui
```

## Deploy (runbook)

Pré-requisitos: conta Cloudflare autenticada (`bunx wrangler login` ou
`CLOUDFLARE_API_TOKEN`).

```sh
# 1. Criar o D1 e colar o database_id real em wrangler.jsonc
bunx wrangler d1 create futcal

# 2. Secret da API-Football
bunx wrangler secret put API_FOOTBALL_KEY

# 3. Migrations no banco remoto
bun run db:migrate:remote

# 4. Build + deploy
bun run deploy
```

Depois: apontar um domínio custom (Workers → Custom Domains) — a URL do feed não
deve mudar depois de publicada, senão quebra as assinaturas existentes. Conferir no
dashboard que o Cron Trigger aparece agendado e, no dia seguinte, a execução em
Workers → Logs.

> **Nota:** o `wrangler.jsonc` está com `database_id` placeholder
> (`00000000-...-0`). O D1 local (miniflare) ignora esse valor; para o deploy
> remoto é obrigatório colar o id real do passo 1.
