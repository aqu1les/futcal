# FutCal ⚽

Calendário assinável (`.ics`) com os jogos dos times que você segue, sincronizado
diariamente. Roda 100% no free tier da Cloudflare: um único Worker serve o front
(Astro + Vue islands), a API, o feed `.ics` e os crons. Banco em D1 (SQLite) com
Drizzle.

## Stack

- **Astro** (adapter `@astrojs/cloudflare`, output `server`) + **Vue 3** em islands
- **D1** + **Drizzle ORM**
- **Cron Triggers** nativos → handler `scheduled` em [src/worker.ts](src/worker.ts)
- Testes em **Vitest** com `@cloudflare/vitest-pool-workers` (rodam no workerd)
- Runtime é o **workerd** — só Web APIs no código, nunca APIs do Bun

## Fonte de dados (provider)

Os jogos vêm da **API pública da ESPN** (sem chave, sem quota) — inclui jogos
**futuros** do Brasileirão A/B, Libertadores, Sudamericana, Copa do Brasil e
estaduais.

A fonte é **plugável** (arquitetura porta/adaptador):

- [src/providers/types.ts](src/providers/types.ts) — o **contrato NOSSO**
  (`MatchProvider` + DTOs neutros + status neutro). O domínio só depende disso.
- [src/providers/espn.ts](src/providers/espn.ts) — o **adaptador ESPN** (URLs,
  slugs de liga, formato do JSON, mapeamento de status). Tudo que é da ESPN vive aqui.
- [src/providers/index.ts](src/providers/index.ts) — o provider ativo. **Trocar de
  fonte = trocar uma linha** e escrever outro adaptador; o domínio não muda.

Ids externos ficam desacoplados dos nossos: `teams` tem id **interno**; o mapa
`(source, external_id) → team_id` fica em `team_sources` (suporta múltiplas fontes).

## Como funciona

- **Populate (1×/ano):** carrega os times das ligas cobertas pro nosso banco. A
  busca é feita sobre o D1 (acento-insensível), sem bater na fonte externa.
- **Sync (diário):** varre as ligas e guarda só os jogos que envolvem um time
  **assinado**, resolvendo os ids internos e aplicando a regra do `revision`
  (que vira o `SEQUENCE` do VEVENT — faz o calendário atualizar em vez de duplicar).
- **Feed:** `/cal/{token}.ics` — o token é a credencial; jogos dos times seguidos
  numa janela de -7 dias a +6 meses.

## Desenvolvimento

```sh
bun install
bun run db:migrate:local      # aplica migrations no D1 local
bun run dev                   # front + endpoints (astro dev)
```

Para exercitar o Worker real (feed, crons, cookies) use a config do build:

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

## Operação manual (por provider)

Endpoints internos protegidos pelo secret `ADMIN_SECRET` (mande sempre
`content-type: application/json` pra passar no CSRF do Astro):

```sh
# popular os times (rodar 1× após deploy; depois o cron anual cuida)
curl -X POST https://<host>/api/internal/populate \
  -H "content-type: application/json" -H "x-admin-secret: <ADMIN_SECRET>"

# forçar um sync dos jogos agora
curl -X POST https://<host>/api/internal/sync \
  -H "content-type: application/json" -H "x-admin-secret: <ADMIN_SECRET>"
```

## Variáveis / bindings

```text
ADMIN_SECRET   # secret → protege os endpoints internos de populate/sync
DB             # binding D1
```

Para dev local, o `ADMIN_SECRET` pode ir num `.dev.vars` (não versionado) ou via
`wrangler dev --var ADMIN_SECRET:<valor>`.

## Deploy (runbook)

Pré-requisitos: conta Cloudflare autenticada (`bunx wrangler login` ou
`CLOUDFLARE_API_TOKEN`). O `database_id` do D1 já está no `wrangler.jsonc`.

```sh
# 1. secret dos endpoints internos
printf '%s' "<um-segredo-forte>" | bunx wrangler secret put ADMIN_SECRET

# 2. migrations no banco remoto
bun run db:migrate:remote

# 3. build + deploy
bun run deploy

# 4. popular os times (uma vez)
curl -X POST https://<host>/api/internal/populate \
  -H "content-type: application/json" -H "x-admin-secret: <ADMIN_SECRET>"
```

Crons no dashboard: `0 9 * * *` (sync diário, 06:00 BRT) e `0 8 1 2 *` (populate
anual, 1º de fevereiro). Domínio custom via Workers → Custom Domains (a URL do
feed não deve mudar depois de publicada, senão quebra as assinaturas).
