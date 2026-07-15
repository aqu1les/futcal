// ─────────────────────────────────────────────────────────────────────────
// CONTRATO — isto é NOSSO, não de nenhum provider.
//
// O domínio (populate, sync, feed) depende SÓ deste arquivo. Cada fonte externa
// (ESPN hoje, outra amanhã) implementa este contrato num adaptador em
// src/providers/<fonte>.ts, traduzindo o formato dela para estes DTOs neutros.
// Trocar de provider = escrever outro adaptador; o domínio não muda.
// ─────────────────────────────────────────────────────────────────────────

// Status neutro de um jogo (NOSSO vocabulário). O adaptador do provider é quem
// mapeia o status dele para um destes.
export type FixtureStatus =
  | 'scheduled'
  | 'live'
  | 'finished'
  | 'postponed'
  | 'canceled'
  | 'unknown';

// Time como o domínio entende. `externalId` é o id do time NA FONTE (guardado em
// team_sources junto com `source`); todo o resto é neutro.
export interface ProviderTeam {
  externalId: string;
  name: string;
  logo: string | null;
  country: string | null;
}

// Jogo como o domínio entende. `externalId`/`*ExternalId` são ids DA FONTE;
// o domínio resolve os ids internos e calcula o revision.
export interface ProviderFixture {
  externalId: string;
  startsAt: Date;
  status: FixtureStatus;
  home: string;
  away: string;
  homeExternalId: string;
  awayExternalId: string;
  competition: string;
  round: string | null;
  venue: string | null;
}

// A porta que todo provider de jogos precisa implementar.
export interface MatchProvider {
  // Identifica a fonte; vira a coluna `source` em team_sources/fixtures.
  readonly source: string;

  // Todos os times das competições cobertas (usado no populate anual).
  listTeams(): Promise<ProviderTeam[]>;

  // Todos os jogos das competições cobertas na janela [from, to]
  // (usado na varredura diária). O domínio filtra o que interessa.
  listFixtures(from: Date, to: Date): Promise<ProviderFixture[]>;
}
