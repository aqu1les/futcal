import type { Fixture, NewFixture } from '../db/schema';
import type { FixtureStatus } from '../providers/types';

// Jogo já resolvido pelo sync: DTO neutro do provider + ids INTERNOS dos times
// (null pro adversário que não está no nosso banco).
export interface ResolvedFixture {
  source: string;
  externalId: string;
  home: string;
  away: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  competition: string;
  round: string | null;
  venue: string | null;
  startsAt: Date;
  status: FixtureStatus;
}

// Só os campos que decidem se o revision incrementa.
type ExistingFixture = Pick<Fixture, 'startsAt' | 'status' | 'revision'>;

/**
 * Monta o set do upsert de um fixture, calculando o `revision`.
 *
 * Regra central do domínio: `revision` incrementa sempre que `starts_at` OU
 * `status` mudarem num fixture já existente. Esse campo vira o SEQUENCE do
 * VEVENT — é o que faz o calendário do usuário atualizar o evento no lugar de
 * duplicar. Função pura pra ser testável sem banco.
 */
export function computeFixtureUpsert(
  incoming: ResolvedFixture,
  existing: ExistingFixture | undefined,
  now: Date,
): Omit<NewFixture, 'id'> {
  let revision = 0;
  if (existing) {
    const changed =
      incoming.startsAt.getTime() !== existing.startsAt.getTime() ||
      incoming.status !== existing.status;
    revision = existing.revision + (changed ? 1 : 0);
  }

  return {
    source: incoming.source,
    externalId: incoming.externalId,
    home: incoming.home,
    away: incoming.away,
    homeTeamId: incoming.homeTeamId,
    awayTeamId: incoming.awayTeamId,
    competition: incoming.competition,
    round: incoming.round,
    venue: incoming.venue,
    startsAt: incoming.startsAt,
    status: incoming.status,
    revision,
    updatedAt: now,
  };
}
