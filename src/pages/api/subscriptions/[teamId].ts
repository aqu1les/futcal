import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { getDb } from '../../../db';
import { unfollowTeam } from '../../../lib/subscriptions';

export const prerender = false;

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response(null, { status: 401 });

  const teamId = Number(params.teamId);
  if (!Number.isInteger(teamId)) return new Response(null, { status: 400 });

  const db = getDb(env);
  await unfollowTeam(db, locals.user.id, teamId);

  return new Response(null, { status: 204 });
};
