import { describe, expect, it } from 'vitest';
import { computeFixtureUpsert, type ResolvedFixture } from './fixtures';

const now = new Date('2026-07-15T12:00:00Z');

function incoming(overrides: Partial<ResolvedFixture> = {}): ResolvedFixture {
  return {
    source: 'espn',
    externalId: '401841149',
    home: 'Botafogo',
    away: 'Santos',
    homeTeamId: 10,
    awayTeamId: 20,
    competition: 'Brazilian Serie A',
    round: null,
    venue: 'Joao Havelange Stadium',
    startsAt: new Date('2026-07-16T22:30:00Z'),
    status: 'scheduled',
    ...overrides,
  };
}

describe('computeFixtureUpsert', () => {
  it('fixture novo começa com revision 0 e carrega source/external_id', () => {
    const row = computeFixtureUpsert(incoming(), undefined, now);
    expect(row.revision).toBe(0);
    expect(row.source).toBe('espn');
    expect(row.externalId).toBe('401841149');
    expect(row.homeTeamId).toBe(10);
    expect(row.awayTeamId).toBe(20);
    expect(row.updatedAt).toEqual(now);
  });

  it('data alterada num fixture existente → revision incrementa', () => {
    const existing = { startsAt: new Date('2026-07-16T22:30:00Z'), status: 'scheduled', revision: 3 };
    const row = computeFixtureUpsert(
      incoming({ startsAt: new Date('2026-07-17T22:30:00Z') }),
      existing,
      now,
    );
    expect(row.revision).toBe(4);
  });

  it('status alterado (adiado) num fixture existente → revision incrementa', () => {
    const existing = { startsAt: new Date('2026-07-16T22:30:00Z'), status: 'scheduled', revision: 0 };
    const row = computeFixtureUpsert(incoming({ status: 'postponed' }), existing, now);
    expect(row.revision).toBe(1);
    expect(row.status).toBe('postponed');
  });

  it('mesma data e status → revision NÃO incrementa', () => {
    const existing = { startsAt: new Date('2026-07-16T22:30:00Z'), status: 'scheduled', revision: 5 };
    const row = computeFixtureUpsert(incoming({ venue: 'Outro' }), existing, now);
    expect(row.revision).toBe(5);
  });
});
