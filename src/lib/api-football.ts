import type { FixtureInput } from './fixtures';

// Wrapper fino sobre a API-Football (api-sports.io). Só tipamos os campos usados.
const BASE_URL = 'https://v3.football.api-sports.io';

// ---- Respostas da API (parcial) ----

interface ApiEnvelope<T> {
  errors: string[] | Record<string, string>;
  results: number;
  response: T[];
}

interface ApiTeamEntry {
  team: {
    id: number;
    name: string;
    country: string | null;
    logo: string | null;
  };
}

interface ApiFixtureEntry {
  fixture: {
    id: number;
    date: string;
    venue: { name: string | null } | null;
    status: { short: string };
  };
  league: {
    name: string;
    round: string | null;
  };
  teams: {
    home: { name: string };
    away: { name: string };
  };
}

// ---- Resultado normalizado ----

export interface TeamResult {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
}

async function apiGet<T>(
  env: Cloudflare.Env,
  path: string,
  params: Record<string, string>,
): Promise<ApiEnvelope<T>> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    headers: { 'x-apisports-key': env.API_FOOTBALL_KEY },
  });

  if (!res.ok) {
    throw new Error(`API-Football ${path} respondeu ${res.status}`);
  }

  const body = (await res.json()) as ApiEnvelope<T>;
  const errors = body.errors;
  const hasErrors = Array.isArray(errors)
    ? errors.length > 0
    : Object.keys(errors ?? {}).length > 0;
  if (hasErrors) {
    throw new Error(`API-Football ${path} retornou erros: ${JSON.stringify(errors)}`);
  }

  return body;
}

export async function searchTeams(
  env: Cloudflare.Env,
  query: string,
): Promise<TeamResult[]> {
  const body = await apiGet<ApiTeamEntry>(env, '/teams', { search: query });
  return body.response.map((entry) => ({
    id: entry.team.id,
    name: entry.team.name,
    logo: entry.team.logo,
    country: entry.team.country,
  }));
}

export async function fixturesByTeam(
  env: Cloudflare.Env,
  teamId: number,
  season: number,
): Promise<FixtureInput[]> {
  const body = await apiGet<ApiFixtureEntry>(env, '/fixtures', {
    team: String(teamId),
    season: String(season),
  });

  return body.response.map((entry) => ({
    id: entry.fixture.id,
    teamId,
    home: entry.teams.home.name,
    away: entry.teams.away.name,
    competition: entry.league.name,
    round: entry.league.round,
    venue: entry.fixture.venue?.name ?? null,
    startsAt: new Date(entry.fixture.date),
    status: entry.fixture.status.short,
  }));
}
