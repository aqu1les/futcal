import { eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../db';
import { fixtures, subscriptions, teamSources } from '../db/schema';
import type { MatchProvider } from '../providers/types';
import { computeFixtureUpsert, type ResolvedFixture } from './fixtures';

export interface SyncSummary {
  fetched: number;
  stored: number;
  created: number;
  updated: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Varre os jogos do provider na janela (-7 dias a +6 meses) e guarda no D1
 * apenas os que envolvem um time ASSINADO, resolvendo os ids internos de
 * mandante/visitante via team_sources e aplicando a regra do `revision`.
 */
export async function syncFixtures(
  db: Db,
  provider: MatchProvider,
  opts: { now?: Date } = {},
): Promise<SyncSummary> {
  const now = opts.now ?? new Date();
  const from = new Date(now.getTime() - 7 * DAY_MS);
  const to = new Date(now.getTime() + 182 * DAY_MS);

  const providerFixtures = await provider.listFixtures(from, to);

  // external_id (da fonte) → id interno do time
  const sources = await db
    .select({ externalId: teamSources.externalId, teamId: teamSources.teamId })
    .from(teamSources)
    .where(eq(teamSources.source, provider.source))
    .all();
  const externalToInternal = new Map(sources.map((s) => [s.externalId, s.teamId]));

  // times com pelo menos um assinante
  const subs = await db
    .selectDistinct({ teamId: subscriptions.teamId })
    .from(subscriptions)
    .all();
  const subscribed = new Set(subs.map((s) => s.teamId));

  // fixtures já existentes desta fonte (pra calcular o revision)
  const existingRows = await db
    .select({
      externalId: fixtures.externalId,
      startsAt: fixtures.startsAt,
      status: fixtures.status,
      revision: fixtures.revision,
    })
    .from(fixtures)
    .where(eq(fixtures.source, provider.source))
    .all();
  const existing = new Map(existingRows.map((r) => [r.externalId, r]));

  const summary: SyncSummary = {
    fetched: providerFixtures.length,
    stored: 0,
    created: 0,
    updated: 0,
  };
  const now2 = now;
  const statements: BatchItem<'sqlite'>[] = [];

  for (const pf of providerFixtures) {
    const homeTeamId = externalToInternal.get(pf.homeExternalId) ?? null;
    const awayTeamId = externalToInternal.get(pf.awayExternalId) ?? null;

    const relevant =
      (homeTeamId !== null && subscribed.has(homeTeamId)) ||
      (awayTeamId !== null && subscribed.has(awayTeamId));
    if (!relevant) continue;

    const resolved: ResolvedFixture = {
      source: provider.source,
      externalId: pf.externalId,
      home: pf.home,
      away: pf.away,
      homeTeamId,
      awayTeamId,
      competition: pf.competition,
      round: pf.round,
      venue: pf.venue,
      startsAt: pf.startsAt,
      status: pf.status,
    };

    const prev = existing.get(pf.externalId);
    const row = computeFixtureUpsert(resolved, prev, now2);

    if (!prev) summary.created += 1;
    else if (row.revision !== prev.revision) summary.updated += 1;
    summary.stored += 1;

    statements.push(
      db
        .insert(fixtures)
        .values(row)
        .onConflictDoUpdate({
          target: [fixtures.source, fixtures.externalId],
          set: row,
        }),
    );
  }

  if (statements.length > 0) {
    await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
  }

  return summary;
}
