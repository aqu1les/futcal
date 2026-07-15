import { eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { getDb } from '../db';
import { fixtures as fixturesTable, subscriptions } from '../db/schema';
import { fixturesByTeam } from './api-football';
import { computeFixtureUpsert } from './fixtures';

export interface SyncSummary {
  teamsSynced: number;
  teamsFailed: number;
  created: number;
  updated: number;
  requestsUsed: number;
}

/**
 * Sincroniza fixtures da API-Football por TIME. Sem `teamIds`, sincroniza todos
 * os times com ≥1 assinante. Upsert em batch aplicando a regra do `revision`.
 * Falha em um time é logada e não aborta o sync inteiro.
 */
export async function syncFixtures(
  env: Cloudflare.Env,
  teamIds?: number[],
): Promise<SyncSummary> {
  const db = getDb(env);
  const season = Number(env.API_FOOTBALL_SEASON);

  let ids = teamIds;
  if (!ids) {
    const rows = await db
      .selectDistinct({ teamId: subscriptions.teamId })
      .from(subscriptions)
      .all();
    ids = rows.map((r) => r.teamId);
  }

  const summary: SyncSummary = {
    teamsSynced: 0,
    teamsFailed: 0,
    created: 0,
    updated: 0,
    requestsUsed: 0,
  };
  const now = new Date();

  for (const teamId of ids) {
    try {
      const incoming = await fixturesByTeam(env, teamId, season);
      summary.requestsUsed += 1;

      const existingRows = await db
        .select({
          id: fixturesTable.id,
          startsAt: fixturesTable.startsAt,
          status: fixturesTable.status,
          revision: fixturesTable.revision,
        })
        .from(fixturesTable)
        .where(eq(fixturesTable.teamId, teamId))
        .all();
      const existing = new Map(existingRows.map((r) => [r.id, r]));

      const statements: BatchItem<'sqlite'>[] = [];
      for (const f of incoming) {
        const prev = existing.get(f.id);
        const row = computeFixtureUpsert(f, prev, now);

        if (!prev) {
          summary.created += 1;
        } else if (row.revision !== prev.revision) {
          summary.updated += 1;
        }

        const { id: _id, ...set } = row;
        statements.push(
          db
            .insert(fixturesTable)
            .values(row)
            .onConflictDoUpdate({ target: fixturesTable.id, set }),
        );
      }

      if (statements.length > 0) {
        await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
      }
      summary.teamsSynced += 1;
    } catch (err) {
      summary.teamsFailed += 1;
      console.error(`sync falhou para o time ${teamId}:`, err);
    }
  }

  return summary;
}
