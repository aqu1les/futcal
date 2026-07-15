import { describe, expect, it } from 'vitest';
import scoreboard from '../../tests/fixtures/espn-scoreboard.json';
import { _internal } from './espn';

const { parseEvents, toFixtureStatus, toEspnDate } = _internal;

describe('ESPN adapter · parseEvents', () => {
  it('mapeia um evento do scoreboard para o DTO neutro', () => {
    const fixtures = parseEvents(scoreboard as never);
    expect(fixtures.length).toBe(5);

    const botafogo = fixtures.find((f) => f.externalId === '401841149');
    expect(botafogo).toEqual({
      externalId: '401841149',
      startsAt: new Date('2026-07-16T22:30Z'),
      status: 'scheduled',
      home: 'Botafogo',
      away: 'Santos',
      homeExternalId: '6086',
      awayExternalId: '2674',
      competition: 'Brazilian Serie A',
      round: null,
      venue: 'Joao Havelange Stadium',
    });
  });
});

describe('ESPN adapter · toFixtureStatus', () => {
  it('traduz status da ESPN para o vocabulário neutro', () => {
    expect(toFixtureStatus('pre', 'STATUS_SCHEDULED')).toBe('scheduled');
    expect(toFixtureStatus('in', 'STATUS_FIRST_HALF')).toBe('live');
    expect(toFixtureStatus('post', 'STATUS_FULL_TIME')).toBe('finished');
    expect(toFixtureStatus('pre', 'STATUS_POSTPONED')).toBe('postponed');
    expect(toFixtureStatus('pre', 'STATUS_CANCELED')).toBe('canceled');
  });
});

describe('ESPN adapter · toEspnDate', () => {
  it('formata a data em YYYYMMDD (UTC)', () => {
    expect(toEspnDate(new Date('2026-07-16T22:30:00Z'))).toBe('20260716');
    expect(toEspnDate(new Date('2026-01-05T00:00:00Z'))).toBe('20260105');
  });
});
