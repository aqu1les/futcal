import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { and, eq, gte, inArray, lte, or } from 'drizzle-orm';
import { getDb } from '../../db';
import { fixtures, subscriptions, teams, users } from '../../db/schema';
import { buildCalendar, type IcsFixture } from '../../lib/ics';
import type { FixtureStatus } from '../../providers/types';

export const prerender = false;

const DAY_MS = 24 * 60 * 60 * 1000;

export const GET: APIRoute = async ({ params }) => {
  const token = params.token;
  if (!token) return new Response('Not found', { status: 404 });

  const db = getDb(env);

  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.calToken, token))
    .get();
  if (!user) return new Response('Not found', { status: 404 });

  const subbed = await db
    .select({ id: teams.id, name: teams.name })
    .from(subscriptions)
    .innerJoin(teams, eq(subscriptions.teamId, teams.id))
    .where(eq(subscriptions.userId, user.id))
    .all();

  const now = new Date();
  const from = new Date(now.getTime() - 7 * DAY_MS);
  const to = new Date(now.getTime() + 182 * DAY_MS); // ~6 meses

  let rows: IcsFixture[] = [];
  if (subbed.length > 0) {
    const ids = subbed.map((t) => t.id);
    const raw = await db
      .select({
        id: fixtures.id,
        home: fixtures.home,
        away: fixtures.away,
        competition: fixtures.competition,
        round: fixtures.round,
        venue: fixtures.venue,
        startsAt: fixtures.startsAt,
        status: fixtures.status,
        revision: fixtures.revision,
      })
      .from(fixtures)
      .where(
        and(
          or(inArray(fixtures.homeTeamId, ids), inArray(fixtures.awayTeamId, ids)),
          gte(fixtures.startsAt, from),
          lte(fixtures.startsAt, to),
        ),
      )
      .all();
    rows = raw.map((r) => ({ ...r, status: r.status as FixtureStatus }));
  }

  const calName =
    subbed.length > 0 ? subbed.map((t) => t.name).join(', ') : 'FutCal';

  const ics = buildCalendar({ calName, fixtures: rows, now });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};
