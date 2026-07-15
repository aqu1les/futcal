import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { getDb } from '../../../db';
import { populateTeams } from '../../../lib/populate';
import { provider } from '../../../providers';

export const prerender = false;

// Populate manual dos times, a partir do provider ativo. Rode com:
//   curl -X POST https://<host>/api/internal/populate \
//     -H "content-type: application/json" -H "x-admin-secret: <ADMIN_SECRET>"
export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get('x-admin-secret') !== env.ADMIN_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  const summary = await populateTeams(getDb(env), provider);
  return Response.json({ provider: provider.source, ...summary });
};
