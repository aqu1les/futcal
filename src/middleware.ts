import { env } from 'cloudflare:workers';
import { defineMiddleware } from 'astro:middleware';
import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { users } from './db/schema';

export const USER_COOKIE = 'futcal_uid';

// Resolve o usuário anônimo a partir do cookie httpOnly. NÃO cria user aqui —
// a criação acontece na primeira ação de "seguir" (POST /api/subscriptions).
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;

  const uid = context.cookies.get(USER_COOKIE)?.value;
  if (uid) {
    const db = getDb(env);
    const user = await db.select().from(users).where(eq(users.id, uid)).get();
    context.locals.user = user ?? null;
  }

  return next();
});
