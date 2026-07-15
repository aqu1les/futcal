import { env } from 'cloudflare:test';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db';
import { teamSources, teams } from '../db/schema';
import type { MatchProvider, ProviderTeam } from '../providers/types';
import { populateTeams } from './populate';

const db = getDb(env);

function fakeProvider(list: ProviderTeam[]): MatchProvider {
  return {
    source: 'espn',
    listTeams: async () => list,
    listFixtures: async () => [],
  };
}

const fluminense: ProviderTeam = {
  externalId: '3445',
  name: 'Fluminense',
  logo: 'https://a/3445.png',
  country: null,
};
const botafogo: ProviderTeam = {
  externalId: '6086',
  name: 'Botafogo',
  logo: 'https://a/6086.png',
  country: null,
};

beforeEach(async () => {
  await db.delete(teamSources);
  await db.delete(teams);
});

describe('populateTeams', () => {
  it('cria teams internos e o mapa team_sources', async () => {
    const summary = await populateTeams(db, fakeProvider([fluminense, botafogo]));

    expect(summary).toMatchObject({ fetched: 2, created: 2, updated: 0 });

    const allTeams = await db.select().from(teams).all();
    expect(allTeams).toHaveLength(2);

    const src = await db
      .select()
      .from(teamSources)
      .where(and(eq(teamSources.source, 'espn'), eq(teamSources.externalId, '3445')))
      .get();
    expect(src).toBeTruthy();
    const team = allTeams.find((t) => t.id === src!.teamId);
    expect(team?.name).toBe('Fluminense');
  });

  it('é idempotente: segunda passada atualiza, não duplica', async () => {
    await populateTeams(db, fakeProvider([fluminense]));
    const summary = await populateTeams(
      db,
      fakeProvider([{ ...fluminense, name: 'Fluminense FC' }]),
    );

    expect(summary).toMatchObject({ created: 0, updated: 1 });
    const allTeams = await db.select().from(teams).all();
    expect(allTeams).toHaveLength(1);
    expect(allTeams[0].name).toBe('Fluminense FC');
  });
});
