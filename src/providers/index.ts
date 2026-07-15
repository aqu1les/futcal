import { espnProvider } from './espn';
import type { MatchProvider } from './types';

// Provider ativo. Trocar de fonte = trocar esta linha por outro adaptador
// (que implemente MatchProvider). Nada mais no domínio precisa mudar.
export const provider: MatchProvider = espnProvider;

export type { MatchProvider, ProviderFixture, ProviderTeam, FixtureStatus } from './types';
