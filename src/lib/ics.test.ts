import { describe, expect, it } from 'vitest';
import { buildCalendar, type IcsFixture } from './ics';

const now = new Date('2026-07-15T09:00:00Z');

const base: IcsFixture = {
  id: 1300001,
  home: 'Fluminense',
  away: 'Flamengo',
  competition: 'Serie A',
  round: 'Regular Season - 15',
  venue: 'Maracana',
  startsAt: new Date('2026-08-01T22:00:00Z'),
  status: 'scheduled',
  revision: 2,
};

// Divide o .ics em linhas físicas (já com folding aplicado).
function lines(ics: string): string[] {
  return ics.split('\r\n');
}

describe('buildCalendar', () => {
  it('usa CRLF entre as linhas', () => {
    const ics = buildCalendar({ calName: 'Fluminense', fixtures: [base], now });
    expect(ics).toContain('\r\n');
    expect(ics).not.toMatch(/[^\r]\n/); // todo \n é precedido de \r
  });

  it('inclui o cabeçalho do calendário', () => {
    const ics = buildCalendar({ calName: 'Fluminense', fixtures: [base], now });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('X-WR-CALNAME:Fluminense');
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT12H');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('monta o VEVENT com UID estável, SEQUENCE e horários UTC (2h de duração)', () => {
    const ics = buildCalendar({ calName: 'Fluminense', fixtures: [base], now });
    expect(ics).toContain('UID:fixture-1300001@futcal');
    expect(ics).toContain('SEQUENCE:2');
    expect(ics).toContain('DTSTART:20260801T220000Z');
    expect(ics).toContain('DTEND:20260802T000000Z');
    expect(ics).toContain('SUMMARY:Fluminense x Flamengo — Serie A');
    expect(ics).toContain('LOCATION:Maracana');
    expect(ics).toContain('DESCRIPTION:Serie A · Regular Season - 15');
  });

  it('mapeia status postponed para STATUS:TENTATIVE', () => {
    const pst: IcsFixture = { ...base, status: 'postponed' };
    const ics = buildCalendar({ calName: 'x', fixtures: [pst], now });
    expect(ics).toContain('STATUS:TENTATIVE');
  });

  it('escapa vírgula e ponto-e-vírgula no texto', () => {
    const tricky: IcsFixture = { ...base, competition: 'Copa, do; Brasil' };
    const ics = buildCalendar({ calName: 'x', fixtures: [tricky], now });
    expect(ics).toContain('Copa\\, do\\; Brasil');
  });

  it('faz folding de linhas com mais de 75 octetos', () => {
    const longName: IcsFixture = {
      ...base,
      venue: 'Estadio Municipal Paulo Machado de Carvalho Pacaembu Zona Oeste Sao Paulo Brasil',
    };
    const ics = buildCalendar({ calName: 'x', fixtures: [longName], now });
    for (const line of lines(ics)) {
      // octetos, não caracteres
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    // continuação de linha começa com espaço
    expect(ics).toMatch(/\r\n /);
  });

  it('bate com o snapshot conhecido', () => {
    const ics = buildCalendar({
      calName: 'Fluminense',
      fixtures: [base],
      now,
    });
    expect(ics).toMatchSnapshot();
  });
});
