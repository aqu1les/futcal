import type { Fixture, NewFixture } from '../db/schema';

// Dados de um jogo vindos da API-Football, já normalizados.
export interface FixtureInput {
  id: number;
  teamId: number;
  home: string;
  away: string;
  competition: string;
  round: string | null;
  venue: string | null;
  startsAt: Date;
  status: string;
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
  incoming: FixtureInput,
  existing: ExistingFixture | undefined,
  now: Date,
): NewFixture {
  let revision = 0;
  if (existing) {
    const changed =
      incoming.startsAt.getTime() !== existing.startsAt.getTime() ||
      incoming.status !== existing.status;
    revision = existing.revision + (changed ? 1 : 0);
  }

  return {
    id: incoming.id,
    teamId: incoming.teamId,
    home: incoming.home,
    away: incoming.away,
    competition: incoming.competition,
    round: incoming.round,
    venue: incoming.venue,
    startsAt: incoming.startsAt,
    status: incoming.status,
    revision,
    updatedAt: now,
  };
}
