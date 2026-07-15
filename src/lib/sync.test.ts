import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixturesJson from '../../tests/fixtures/api-football-fixtures.json';
import { getDb } from '../db';
import { fixtures, subscriptions, teams, users } from '../db/schema';
import { syncFixtures } from './sync';

const db = getDb(env);

afterEach(() => vi.restoreAllMocks());

beforeEach(async () => {
  // Limpa entre testes (cascata via FKs não é garantida sem PRAGMA, então limpamos na ordem).
  await db.delete(fixtures);
  await db.delete(subscriptions);
  await db.delete(users);
  await db.delete(teams);
});

function respondWith(json: unknown, status = 200) {
  return new Response(JSON.stringify(json), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('syncFixtures', () => {
  it('cria jogos novos e reagenda jogos existentes (revision++)', async () => {
    await db.insert(users).values({ id: 'u1', calToken: 'tok1' });
    await db.insert(teams).values({ id: 124, name: 'Fluminense' });
    await db.insert(subscriptions).values({ userId: 'u1', teamId: 124 });
    // Jogo já existente com data ANTIGA (diferente do que a API vai retornar).
    await db.insert(fixtures).values({
      id: 1300001,
      teamId: 124,
      home: 'Fluminense',
      away: 'Flamengo',
      competition: 'Serie A',
      round: 'Regular Season - 15',
      venue: 'Maracana',
      startsAt: new Date('2026-07-30T22:00:00Z'),
      status: 'NS',
      revision: 0,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respondWith(fixturesJson));

    const summary = await syncFixtures(env);

    expect(summary.teamsSynced).toBe(1);
    expect(summary.teamsFailed).toBe(0);
    expect(summary.created).toBe(1); // 1300002
    expect(summary.updated).toBe(1); // 1300001 (data mudou)
    expect(summary.requestsUsed).toBe(1);

    const reagendado = await db
      .select()
      .from(fixtures)
      .where(eq(fixtures.id, 1300001))
      .get();
    expect(reagendado?.revision).toBe(1);
    expect(reagendado?.startsAt).toEqual(new Date('2026-08-01T22:00:00Z'));

    const novo = await db.select().from(fixtures).where(eq(fixtures.id, 1300002)).get();
    expect(novo?.revision).toBe(0);
    expect(novo?.status).toBe('PST');
  });

  it('sincroniza apenas os times passados quando teamIds é fornecido', async () => {
    await db.insert(teams).values({ id: 124, name: 'Fluminense' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respondWith(fixturesJson));

    const summary = await syncFixtures(env, [124]);

    expect(summary.teamsSynced).toBe(1);
    expect(summary.requestsUsed).toBe(1);
    const all = await db.select().from(fixtures).all();
    expect(all).toHaveLength(2);
  });

  it('falha em um time não aborta o sync inteiro', async () => {
    await db.insert(users).values({ id: 'u1', calToken: 'tok1' });
    await db.insert(teams).values([
      { id: 124, name: 'Fluminense' },
      { id: 999, name: 'Time Quebrado' },
    ]);
    await db.insert(subscriptions).values([
      { userId: 'u1', teamId: 124 },
      { userId: 'u1', teamId: 999 },
    ]);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('team=999')) return respondWith({}, 500);
      return respondWith(fixturesJson);
    });

    const summary = await syncFixtures(env);

    expect(summary.teamsSynced).toBe(1);
    expect(summary.teamsFailed).toBe(1);
    const all = await db.select().from(fixtures).all();
    expect(all).toHaveLength(2); // só os do time 124
  });
});
