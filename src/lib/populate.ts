import { and, eq } from 'drizzle-orm';
import type { Db } from '../db';
import { teamSources, teams } from '../db/schema';
import type { MatchProvider } from '../providers/types';
import { normalizeSearch } from './text';

export interface PopulateSummary {
  fetched: number;
  created: number;
  updated: number;
}

/**
 * Popula a tabela de times (id interno) a partir do provider, mantendo o mapa
 * team_sources (source, external_id) → id interno. Idempotente: rodar de novo
 * atualiza nome/logo em vez de duplicar. Pensado pra rodar 1×/ano.
 */
export async function populateTeams(
  db: Db,
  provider: MatchProvider,
): Promise<PopulateSummary> {
  const providerTeams = await provider.listTeams();
  const summary: PopulateSummary = {
    fetched: providerTeams.length,
    created: 0,
    updated: 0,
  };

  for (const t of providerTeams) {
    const mapped = await db
      .select({ teamId: teamSources.teamId })
      .from(teamSources)
      .where(
        and(
          eq(teamSources.source, provider.source),
          eq(teamSources.externalId, t.externalId),
        ),
      )
      .get();

    const searchName = normalizeSearch(t.name);
    if (mapped) {
      await db
        .update(teams)
        .set({ name: t.name, searchName, logo: t.logo, country: t.country })
        .where(eq(teams.id, mapped.teamId));
      summary.updated += 1;
    } else {
      const [row] = await db
        .insert(teams)
        .values({ name: t.name, searchName, logo: t.logo, country: t.country })
        .returning({ id: teams.id });
      await db.insert(teamSources).values({
        source: provider.source,
        externalId: t.externalId,
        teamId: row.id,
      });
      summary.created += 1;
    }
  }

  return summary;
}
