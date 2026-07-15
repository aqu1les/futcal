import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { getDb } from '../../db';
import { provider } from '../../providers';
import { followTeam } from '../../lib/subscriptions';
import { syncFixtures } from '../../lib/sync';
import { USER_COOKIE } from '../../middleware';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  let teamId: number;
  try {
    const body = (await request.json()) as { teamId?: number };
    if (typeof body.teamId !== 'number' || !Number.isInteger(body.teamId)) {
      return Response.json({ error: 'invalid_team' }, { status: 400 });
    }
    teamId = body.teamId;
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const db = getDb(env);
  const { user, isNewUser } = await followTeam(db, {
    userId: locals.user?.id ?? null,
    teamId,
  });

  if (isNewUser) {
    cookies.set(USER_COOKIE, user.id, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 ano
    });
  }

  // Popula o feed inline pra não ficar vazio até o cron do dia seguinte.
  const syncing = syncFixtures(db, provider).catch((e) =>
    console.error('sync inline falhou', e),
  );
  locals.cfContext?.waitUntil?.(syncing);

  return Response.json({ ok: true, calToken: user.calToken });
};
