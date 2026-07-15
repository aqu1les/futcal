import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db';
import { fixtures, subscriptions, teamSources, teams, users } from '../db/schema';
import type { MatchProvider, ProviderFixture } from '../providers/types';
import { syncFixtures } from './sync';

const db = getDb(env);

function fakeProvider(list: ProviderFixture[]): MatchProvider {
  return {
    source: 'espn',
    listTeams: async () => [],
    listFixtures: async () => list,
  };
}

// Jogo Botafogo (6086) x Fluminense (3445)
function fluGame(overrides: Partial<ProviderFixture> = {}): ProviderFixture {
  return {
    externalId: '401841149',
    startsAt: new Date('2026-07-17T23:00:00Z'),
    status: 'scheduled',
    home: 'Botafogo',
    away: 'Fluminense',
    homeExternalId: '6086',
    awayExternalId: '3445',
    competition: 'Brazilian Serie A',
    round: null,
    venue: 'Maracana',
    ...overrides,
  };
}

// Jogo entre dois times que ninguém segue
const outroGame: ProviderFixture = {
  externalId: '999',
  startsAt: new Date('2026-07-18T20:00:00Z'),
  status: 'scheduled',
  home: 'Time A',
  away: 'Time B',
  homeExternalId: '111',
  awayExternalId: '222',
  competition: 'Brazilian Serie A',
  round: null,
  venue: null,
};

let fluId: number;
let botafogoId: number;

beforeEach(async () => {
  await db.delete(fixtures);
  await db.delete(subscriptions);
  await db.delete(teamSources);
  await db.delete(users);
  await db.delete(teams);

  [{ id: fluId }] = await db
    .insert(teams)
    .values({ name: 'Fluminense', searchName: 'fluminense', logo: null, country: null })
    .returning({ id: teams.id });
  [{ id: botafogoId }] = await db
    .insert(teams)
    .values({ name: 'Botafogo', searchName: 'botafogo', logo: null, country: null })
    .returning({ id: teams.id });
  await db.insert(teamSources).values([
    { source: 'espn', externalId: '3445', teamId: fluId },
    { source: 'espn', externalId: '6086', teamId: botafogoId },
  ]);
  await db.insert(users).values({ id: 'u1', calToken: 'tok1' });
  await db.insert(subscriptions).values({ userId: 'u1', teamId: fluId });
});

describe('syncFixtures', () => {
  it('guarda só jogos de times assinados e resolve os ids internos', async () => {
    const summary = await syncFixtures(db, fakeProvider([fluGame(), outroGame]), {
      now: new Date('2026-07-15T09:00:00Z'),
    });

    expect(summary.created).toBe(1); // só o jogo do Fluminense
    const all = await db.select().from(fixtures).all();
    expect(all).toHaveLength(1);
    expect(all[0].homeTeamId).toBe(botafogoId);
    expect(all[0].awayTeamId).toBe(fluId);
    expect(all[0].source).toBe('espn');
    expect(all[0].externalId).toBe('401841149');
  });

  it('reagendamento incrementa o revision', async () => {
    await syncFixtures(db, fakeProvider([fluGame()]), {
      now: new Date('2026-07-15T09:00:00Z'),
    });
    const summary = await syncFixtures(
      db,
      fakeProvider([fluGame({ startsAt: new Date('2026-07-18T23:00:00Z') })]),
      { now: new Date('2026-07-15T09:00:00Z') },
    );

    expect(summary.updated).toBe(1);
    const row = await db
      .select()
      .from(fixtures)
      .where(eq(fixtures.externalId, '401841149'))
      .get();
    expect(row?.revision).toBe(1);
    expect(row?.startsAt).toEqual(new Date('2026-07-18T23:00:00Z'));
  });
});
