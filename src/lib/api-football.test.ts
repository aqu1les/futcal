import { afterEach, describe, expect, it, vi } from 'vitest';
import fixturesJson from '../../tests/fixtures/api-football-fixtures.json';
import teamsJson from '../../tests/fixtures/api-football-teams.json';
import { fixturesByTeam, searchTeams } from './api-football';

const env = {
  API_FOOTBALL_KEY: 'test-key',
  API_FOOTBALL_SEASON: '2026',
} as Cloudflare.Env;

afterEach(() => vi.restoreAllMocks());

function mockFetch(json: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(json), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

describe('searchTeams', () => {
  it('parses teams and sends the api key header', async () => {
    const spy = mockFetch(teamsJson);
    const teams = await searchTeams(env, 'fluminense');

    expect(teams).toEqual([
      {
        id: 124,
        name: 'Fluminense',
        logo: 'https://media.api-sports.io/football/teams/124.png',
        country: 'Brazil',
      },
      {
        id: 7848,
        name: 'Fluminense PI',
        logo: 'https://media.api-sports.io/football/teams/7848.png',
        country: 'Brazil',
      },
    ]);

    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain('/teams?search=fluminense');
    expect((init as RequestInit | undefined)?.headers).toMatchObject({
      'x-apisports-key': 'test-key',
    });
  });
});

describe('fixturesByTeam', () => {
  it('normalizes fixtures for the queried team', async () => {
    mockFetch(fixturesJson);
    const fixtures = await fixturesByTeam(env, 124, 2026);

    expect(fixtures).toHaveLength(2);
    expect(fixtures[0]).toEqual({
      id: 1300001,
      teamId: 124,
      home: 'Fluminense',
      away: 'Flamengo',
      competition: 'Serie A',
      round: 'Regular Season - 15',
      venue: 'Maracana',
      startsAt: new Date('2026-08-01T22:00:00+00:00'),
      status: 'NS',
    });
  });

  it('handles null venue and postponed status', async () => {
    mockFetch(fixturesJson);
    const fixtures = await fixturesByTeam(env, 124, 2026);

    expect(fixtures[1].venue).toBeNull();
    expect(fixtures[1].status).toBe('PST');
    expect(fixtures[1].teamId).toBe(124);
  });
});
