import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { workerCache } from '../../../lib/cache';
import { searchTeamsCached } from '../../../lib/teams';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let q = '';
  try {
    const body = (await request.json()) as { q?: string };
    q = (body.q ?? '').trim();
  } catch {
    // corpo inválido → trata como busca vazia
  }

  if (q.length < 2) return Response.json([]);

  try {
    const results = await searchTeamsCached(env, q, workerCache);
    return Response.json(results);
  } catch (err) {
    console.error('search de times falhou', err);
    return Response.json({ error: 'search_failed' }, { status: 502 });
  }
};
