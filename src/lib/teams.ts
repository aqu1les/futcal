import { like } from 'drizzle-orm';
import type { Db } from '../db';
import type { Team } from '../db/schema';
import { teams } from '../db/schema';
import { normalizeSearch } from './text';

/**
 * Busca times no NOSSO banco (populado 1×/ano a partir do provider) por nome,
 * acento-insensível. Não bate na API externa — a busca é local e barata.
 */
export async function searchTeams(
  db: Db,
  query: string,
  limit = 20,
): Promise<Team[]> {
  const q = normalizeSearch(query);
  if (q.length < 2) return [];

  return db
    .select()
    .from(teams)
    .where(like(teams.searchName, `%${q}%`))
    .orderBy(teams.name)
    .limit(limit)
    .all();
}
