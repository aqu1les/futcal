import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { getDb } from '../../../db';
import { searchTeams } from '../../../lib/teams';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let q = '';
  try {
    const body = (await request.json()) as { q?: string };
    q = (body.q ?? '').trim();
  } catch {
    // corpo inválido → busca vazia
  }

  const results = await searchTeams(getDb(env), q);
  return Response.json(results);
};
