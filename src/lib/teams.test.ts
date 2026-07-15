import { afterEach, describe, expect, it, vi } from 'vitest';
import teamsJson from '../../tests/fixtures/api-football-teams.json';
import { workerCache } from './cache';
import { searchTeamsCached } from './teams';

const env = {
  API_FOOTBALL_KEY: 'test-key',
  API_FOOTBALL_SEASON: '2026',
} as Cloudflare.Env;

afterEach(() => vi.restoreAllMocks());

function mockFetch() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(teamsJson), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

describe('searchTeamsCached', () => {
  it('bate na API na primeira vez e serve do cache na segunda (mesma query)', async () => {
    const spy = mockFetch();
    const cache = workerCache;
    const q = `fluminense-${crypto.randomUUID()}`; // query única por teste

    const first = await searchTeamsCached(env, q, cache);
    const second = await searchTeamsCached(env, q, cache);

    expect(first).toHaveLength(2);
    expect(second).toEqual(first);
    expect(spy).toHaveBeenCalledTimes(1); // segunda veio do cache
  });

  it('normaliza a query (case/espaços) pra reaproveitar o cache', async () => {
    const spy = mockFetch();
    const cache = workerCache;
    const token = crypto.randomUUID();

    await searchTeamsCached(env, `Fluminense ${token}`, cache);
    await searchTeamsCached(env, `  fluminense ${token}  `, cache);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
