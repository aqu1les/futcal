# FutCal — Plano de implementação (MVP, Cloudflare free tier)

App que gera um calendário assinável (.ics) com os jogos dos times que o usuário escolher, sincronizado diariamente com a API-Football. Roda 100% no free tier da Cloudflare: um único Worker servindo o front (Astro + Vue islands), a API, o feed .ics e o cron de sync. Banco em D1 (SQLite) com Drizzle ORM.

## Decisões já tomadas (não rediscutir)

- **Stack:** Astro (adapter `@astrojs/cloudflare`) + Vue 3 em islands, TypeScript, Tailwind. Bun como package manager e task runner (o runtime em produção é o workerd — NÃO usar APIs do Bun no código da aplicação, apenas Web APIs).
- **Infra:** um único Cloudflare Worker (assets do Astro + endpoints + scheduled handler). D1 como banco, Drizzle como ORM. Cron Trigger nativo, 1x/dia.
- **Sincronização com o calendário do usuário:** feed iCal por usuário (URL com token), NÃO integração OAuth com Google Calendar API. O calendário do usuário re-consulta o feed sozinho.
- **Fonte de dados:** API-Football (api-sports.io), plano free = 100 req/dia. IDs de time e de fixture da API-Football são usados como PK local.
- **Sync:** 1x/dia, por TIME (não por usuário), apenas times com ≥1 assinante.
- **Geração do .ics:** manual (string building), sem lib externa.
- **Sem login/senha no MVP:** usuário criado anonimamente na primeira seleção de times, identificado por cookie httpOnly com id opaco. Auth de verdade fica pra v2.

## Variáveis / bindings

```
API_FOOTBALL_KEY     # secret (wrangler secret put)
API_FOOTBALL_SEASON  # var, ex: 2026
DB                   # binding D1
```

---

## Fase 0 — Bootstrap

```bash
bun create astro@latest futcal -- --template minimal --typescript strict
cd futcal
bunx astro add cloudflare vue tailwind
bun add drizzle-orm
bun add -d drizzle-kit wrangler
bunx wrangler d1 create futcal   # anotar database_id
```

- Criar `wrangler.jsonc`: binding `DB`, `triggers.crons = ["0 9 * * *"]` (06:00 BRT), assets apontando pro build do Astro, `compatibility_date` recente.
- Astro em modo `output: 'server'` com o adapter cloudflare e `platformProxy` habilitado (pra ter D1 no `astro dev`).
- Criar `drizzle.config.ts` apontando pro schema e pra pasta de migrations.
- Commit inicial.

**Aceite:** `bun run dev` abre a página inicial; `bunx wrangler dev` sobe o worker localmente sem erro.

## Fase 1 — Schema e camada de dados

`src/db/schema.ts` (Drizzle, dialeto sqlite):

- `users` — `id` (text uuid PK), `cal_token` (text unique, indexado), `created_at`.
- `teams` — `id` (integer PK, **sem** autoincrement — ID da API-Football), `name`, `logo` (nullable), `country` (nullable).
- `subscriptions` — `user_id` + `team_id`, PK composta, FKs.
- `fixtures` — `id` (integer PK, sem autoincrement — fixture.id da API-Football), `team_id` (indexado), `home`, `away`, `competition`, `round` (nullable), `venue` (nullable), `starts_at` (timestamp, indexado), `status` (NS/PST/FT etc.), `revision` (integer default 0), `updated_at`.

Regra central do domínio: `revision` incrementa sempre que `starts_at` OU `status` mudarem num fixture já existente. Esse campo vira o `SEQUENCE` do VEVENT — é o que faz o calendário do usuário atualizar o evento em vez de duplicar. Implementar como função pura em `src/lib/fixtures.ts` (recebe fixture existente + dados novos, retorna o set do upsert) pra ser testável sem banco.

- Gerar migration com `drizzle-kit generate` e aplicar com `wrangler d1 migrations apply futcal --local`.
- Testes: usar Vitest com `@cloudflare/vitest-pool-workers` (roda os testes dentro do workerd com D1 real em memória) — configurar já nesta fase.

**Aceite:** migrations aplicam do zero local; teste unitário cobrindo "dados com data alterada → revision incrementa; dados iguais → não incrementa".

## Fase 2 — Cliente da API-Football + sync

- `src/lib/api-football.ts`: wrapper fino sobre `fetch` com base `https://v3.football.api-sports.io`, header `x-apisports-key`. Funções: `searchTeams(q)`, `fixturesByTeam(teamId, season)`. Tipar as respostas (só os campos usados).
- `src/lib/sync.ts` → `syncFixtures(env, teamIds?)`:
  1. Sem argumento: coleta `team_id`s distintos de `subscriptions`.
  2. Para cada time, busca fixtures da season e faz upsert (batch com `db.batch()` do D1 pra reduzir round-trips) aplicando a regra do `revision`.
  3. Retorna/loga resumo: times sincronizados, fixtures criados/atualizados, requests usados.
  4. Falha em um time → loga e continua; nunca aborta o sync inteiro.
- Handler `scheduled` no entry do worker chamando `ctx.waitUntil(syncFixtures(env))`. Se o bundling do adapter dificultar o entry custom, fallback: cron chama `POST /api/internal/sync` protegida por secret no header.
- Testes com fetch mockado usando JSON de exemplo da resposta real (criar `tests/fixtures/api-football-fixtures.json`).

**Aceite:** disparar o cron local via `curl "http://localhost:8787/__scheduled?cron=0+9+*+*+*"` popula o D1 com jogos reais do Fluminense (team id 124) usando a key real; testes cobrindo criação, reagendamento e falha parcial.

## Fase 3 — Feed iCal

- Rota `src/pages/cal/[token].ts` (endpoint Astro) — o token É a credencial, sem sessão.
- Busca user pelo `cal_token`, coleta fixtures dos times assinados com `starts_at` entre -7 dias e +6 meses, monta o .ics em `src/lib/ics.ts`.
- Formato de cada VEVENT:
  - `UID: fixture-{id}@futcal` (estável — nunca muda para o mesmo jogo)
  - `SEQUENCE: {revision}`
  - `DTSTART`/`DTEND` em UTC (`Ymd\THis\Z`), duração fixa de 2h
  - `SUMMARY: {home} x {away} — {competition}`
  - `LOCATION: {venue}`, `DESCRIPTION: {competition} · {round}`
  - Status `PST` (adiado) sem nova data → `STATUS:TENTATIVE`
- Cabeçalho: `X-WR-CALNAME` com nomes dos times, `REFRESH-INTERVAL;VALUE=DURATION:PT12H`.
- Cuidados de formato: `\r\n`, folding de linhas >75 octetos, escapar vírgulas/ponto-e-vírgula.
- Response: `Content-Type: text/calendar; charset=utf-8`. Token inválido → 404.
- Teste: snapshot do .ics a partir de fixtures conhecidos.

**Aceite:** assinar a URL no Google Calendar ("adicionar por URL") e os jogos aparecem; feed passa num validador iCal sem erros.

## Fase 4 — UI (Astro + Vue islands)

Três telas, sem firula:

1. **Home / busca de times** — island Vue com busca consultando `POST /api/teams/search` (endpoint Astro que faz proxy pra `searchTeams` com cache de 24h por query — usar a Cache API do Workers ou tabela de cache no D1 — pra poupar quota). Cards com escudo + nome + "seguir".
2. **Meus times** — lista dos seguidos, remover, e bloco "Conectar agenda": URL do feed, botão copiar, link `https://calendar.google.com/calendar/r?cid=webcal://{host}/cal/{token}.ics`, instrução curta pra Apple Calendar.
3. **Próximos jogos** (opcional) — fixtures futuros dos times seguidos, direto do D1, renderizado server-side.

Identidade anônima: na primeira ação de "seguir", `POST /api/subscriptions` cria `user` sem dados pessoais, seta cookie httpOnly de longa duração com o user id; middleware do Astro resolve o user em `locals` a partir do cookie.

Importante: ao seguir um time que ainda não existe em `teams`, criar o registro local e disparar `syncFixtures(env, [teamId])` inline via `ctx.waitUntil`, pra que o feed não fique vazio até o cron do dia seguinte.

**Aceite:** fluxo completo manual — buscar "Fluminense", seguir, copiar URL, assinar no Google, ver os jogos.

## Fase 5 — PWA

- `@vite-pwa/astro`: manifest (nome, ícones, theme color), service worker `autoUpdate`, cache apenas de assets estáticos (NUNCA cachear `/cal/*` nem `/api/*`).

**Aceite:** Lighthouse reconhece como instalável; app abre standalone no Android.

## Fase 6 — Deploy

- `bunx wrangler secret put API_FOOTBALL_KEY`.
- `bunx wrangler d1 migrations apply futcal --remote`.
- `bun run build && bunx wrangler deploy`.
- Domínio custom via dashboard (Workers → Custom Domains) — necessário porque `workers.dev` funciona, mas a URL do feed fica feia e você não quer trocá-la depois (quebra as assinaturas existentes).
- Conferir no dashboard que o Cron Trigger aparece agendado; no dia seguinte, verificar execução em Workers → Logs.
- CI opcional: GitHub Action com `wrangler-action` em push na main.

**Aceite:** app no ar com HTTPS no domínio final, sync rodou pelo cron (log do dia seguinte), feed assinável externamente.

---

## Ordem de execução e validação

Executar as fases em ordem — cada uma depende da anterior. O core do produto é validado no fim da Fase 3 (sync → D1 → feed → Google Calendar); UI vem depois de propósito. Rodar os testes ao fim de cada fase; commits pequenos por fase.

## Limites do free tier (referência rápida)

- Workers: 100k req/dia, 10ms CPU/invocação (sobra pra gerar .ics)
- D1: 5 GB, 5M leituras/dia, 100k escritas/dia
- API-Football: 100 req/dia → com sync 1x/dia, suporta ~90 times com assinantes

## Fora de escopo do MVP (não implementar agora)

- Login com email/OAuth, múltiplos calendários por usuário, notificações push, escrita direta via Google Calendar API, sync adaptativo pré-jogo, placar/resultado nos eventos, i18n.
