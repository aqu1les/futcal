import { searchTeams, type TeamResult } from './api-football';

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24h

function normalize(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function cacheKey(query: string): Request {
  return new Request(
    `https://futcal.cache/teams?q=${encodeURIComponent(normalize(query))}`,
  );
}

/**
 * Busca times na API-Football com cache de 24h por query (Cache API do Workers),
 * pra poupar a quota de 100 req/dia. A query é normalizada (trim + lowercase).
 */
export async function searchTeamsCached(
  env: Cloudflare.Env,
  query: string,
  cache: Cache,
): Promise<TeamResult[]> {
  const key = cacheKey(query);

  const hit = await cache.match(key);
  if (hit) {
    return (await hit.json()) as TeamResult[];
  }

  const results = await searchTeams(env, query);

  await cache.put(
    key,
    new Response(JSON.stringify(results), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${CACHE_TTL_SECONDS}`,
      },
    }),
  );

  return results;
}
