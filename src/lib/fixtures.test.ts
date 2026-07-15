import { describe, expect, it } from 'vitest';
import { computeFixtureUpsert, type FixtureInput } from './fixtures';

const now = new Date('2026-07-15T12:00:00Z');

function input(overrides: Partial<FixtureInput> = {}): FixtureInput {
  return {
    id: 100,
    teamId: 124,
    home: 'Fluminense',
    away: 'Flamengo',
    competition: 'Brasileirao',
    round: 'Regular Season - 15',
    venue: 'Maracana',
    startsAt: new Date('2026-08-01T22:00:00Z'),
    status: 'NS',
    ...overrides,
  };
}

describe('computeFixtureUpsert', () => {
  it('new fixture starts at revision 0', () => {
    const row = computeFixtureUpsert(input(), undefined, now);
    expect(row.revision).toBe(0);
    expect(row.id).toBe(100);
    expect(row.updatedAt).toEqual(now);
  });

  it('changed start date on existing fixture increments revision', () => {
    const existing = { startsAt: new Date('2026-08-01T22:00:00Z'), status: 'NS', revision: 3 };
    const row = computeFixtureUpsert(
      input({ startsAt: new Date('2026-08-02T22:00:00Z') }),
      existing,
      now,
    );
    expect(row.revision).toBe(4);
  });

  it('changed status on existing fixture increments revision', () => {
    const existing = { startsAt: new Date('2026-08-01T22:00:00Z'), status: 'NS', revision: 0 };
    const row = computeFixtureUpsert(input({ status: 'PST' }), existing, now);
    expect(row.revision).toBe(1);
  });

  it('same date and status does not increment revision', () => {
    const existing = { startsAt: new Date('2026-08-01T22:00:00Z'), status: 'NS', revision: 5 };
    const row = computeFixtureUpsert(input({ venue: 'Outro estadio' }), existing, now);
    expect(row.revision).toBe(5);
  });
});
