// ─────────────────────────────────────────────────────────────────────────
// ADAPTADOR ESPN — tudo que é específico da API pública da ESPN vive AQUI.
//
// URLs, slugs de liga, formato do JSON e mapeamento de status são detalhes da
// ESPN e não vazam pro domínio. Lá fora só se enxerga o contrato MatchProvider
// (src/providers/types.ts). Pra trocar de fonte, escreva outro adaptador.
// ─────────────────────────────────────────────────────────────────────────

import type {
  FixtureStatus,
  MatchProvider,
  ProviderFixture,
  ProviderTeam,
} from './types';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

// Competições cobertas (slugs da ESPN). Estaduais só têm jogos Jan–Abr.
const LEAGUES: { slug: string; name: string }[] = [
  { slug: 'bra.1', name: 'Brasileirão Série A' },
  { slug: 'bra.2', name: 'Brasileirão Série B' },
  { slug: 'bra.copa_do_brazil', name: 'Copa do Brasil' },
  { slug: 'conmebol.libertadores', name: 'Libertadores' },
  { slug: 'conmebol.sudamericana', name: 'Sudamericana' },
  { slug: 'bra.camp.carioca', name: 'Campeonato Carioca' },
  { slug: 'bra.camp.paulista', name: 'Campeonato Paulista' },
  { slug: 'bra.camp.mineiro', name: 'Campeonato Mineiro' },
  { slug: 'bra.camp.gaucho', name: 'Campeonato Gaúcho' },
];

// ── Formato do JSON da ESPN (só os campos usados) ──
interface EspnTeamsResponse {
  sports: {
    leagues: {
      teams: {
        team: {
          id: string;
          displayName: string;
          logos?: { href: string }[];
        };
      }[];
    }[];
  }[];
}

interface EspnScoreboardResponse {
  leagues?: { name: string }[];
  events?: EspnEvent[];
}

interface EspnEvent {
  id: string;
  date: string;
  status: { type: { state: string; name: string } };
  competitions: {
    venue?: { fullName?: string };
    notes?: { headline?: string }[];
    competitors: {
      homeAway: 'home' | 'away';
      team: { id: string; displayName: string };
    }[];
  }[];
}

// ── Helpers ESPN ──

// Traduz o status da ESPN para o vocabulário neutro do domínio.
function toFixtureStatus(state: string, name: string): FixtureStatus {
  if (name === 'STATUS_POSTPONED') return 'postponed';
  if (name === 'STATUS_CANCELED' || name === 'STATUS_CANCELLED') return 'canceled';
  if (state === 'pre') return 'scheduled';
  if (state === 'in') return 'live';
  if (state === 'post') return 'finished';
  return 'unknown';
}

// Data → `YYYYMMDD` (UTC), formato do parâmetro `dates` da ESPN.
function toEspnDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN ${url} respondeu ${res.status}`);
  return (await res.json()) as T;
}

function parseEvents(body: EspnScoreboardResponse): ProviderFixture[] {
  const competition = body.leagues?.[0]?.name ?? '';
  const out: ProviderFixture[] = [];

  for (const event of body.events ?? []) {
    const comp = event.competitions[0];
    if (!comp) continue;
    const home = comp.competitors.find((c) => c.homeAway === 'home');
    const away = comp.competitors.find((c) => c.homeAway === 'away');
    if (!home || !away) continue;

    out.push({
      externalId: event.id,
      startsAt: new Date(event.date),
      status: toFixtureStatus(event.status.type.state, event.status.type.name),
      home: home.team.displayName,
      away: away.team.displayName,
      homeExternalId: home.team.id,
      awayExternalId: away.team.id,
      competition,
      round: comp.notes?.[0]?.headline ?? null,
      venue: comp.venue?.fullName ?? null,
    });
  }
  return out;
}

// ── O adaptador ──

export const espnProvider: MatchProvider = {
  source: 'espn',

  async listTeams(): Promise<ProviderTeam[]> {
    const byExternalId = new Map<string, ProviderTeam>();

    for (const league of LEAGUES) {
      try {
        const body = await fetchJson<EspnTeamsResponse>(
          `${BASE}/${league.slug}/teams`,
        );
        const teams = body.sports?.[0]?.leagues?.[0]?.teams ?? [];
        for (const { team } of teams) {
          // Mesmo time aparece em várias ligas — dedupe pelo id da ESPN.
          if (byExternalId.has(team.id)) continue;
          byExternalId.set(team.id, {
            externalId: team.id,
            name: team.displayName,
            logo: team.logos?.[0]?.href ?? null,
            country: null,
          });
        }
      } catch (err) {
        console.error(`ESPN: falha ao listar times de ${league.slug}:`, err);
      }
    }

    return [...byExternalId.values()];
  },

  async listFixtures(from: Date, to: Date): Promise<ProviderFixture[]> {
    const dates = `${toEspnDate(from)}-${toEspnDate(to)}`;
    const out: ProviderFixture[] = [];

    for (const league of LEAGUES) {
      try {
        const body = await fetchJson<EspnScoreboardResponse>(
          `${BASE}/${league.slug}/scoreboard?dates=${dates}&limit=1000`,
        );
        out.push(...parseEvents(body));
      } catch (err) {
        console.error(`ESPN: falha no scoreboard de ${league.slug}:`, err);
      }
    }

    return out;
  },
};

// Exposto só para os testes de parsing (mantém o mapeamento coberto sem rede).
export const _internal = { parseEvents, toFixtureStatus, toEspnDate };
