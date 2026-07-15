import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db';
import { teams } from '../db/schema';
import { normalizeSearch } from './text';
import { searchTeams } from './teams';

const db = getDb(env);

async function seed(names: string[]) {
  await db.insert(teams).values(
    names.map((name) => ({ name, searchName: normalizeSearch(name), logo: null, country: null })),
  );
}

beforeEach(async () => {
  await db.delete(teams);
});

describe('searchTeams', () => {
  it('acha por nome, ignorando acento e caixa', async () => {
    await seed(['Grêmio', 'Fluminense', 'Botafogo']);

    const gremio = await searchTeams(db, 'gremio');
    expect(gremio.map((t) => t.name)).toEqual(['Grêmio']);

    const flu = await searchTeams(db, 'FLU');
    expect(flu.map((t) => t.name)).toEqual(['Fluminense']);
  });

  it('exige ao menos 2 caracteres', async () => {
    await seed(['Fluminense']);
    expect(await searchTeams(db, 'f')).toEqual([]);
  });
});
