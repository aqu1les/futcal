import { and, eq } from 'drizzle-orm';
import type { Db } from '../db';
import type { User } from '../db/schema';
import { subscriptions, users } from '../db/schema';
import { createAnonUser } from './users';

export interface FollowResult {
  user: User;
  isNewUser: boolean;
}

/**
 * Segue um time (id INTERNO — o time já existe, veio do populate). Cria o
 * usuário anônimo se ainda não existir e insere a subscription (idempotente).
 * Retorna o user e se ele acabou de ser criado (pra o endpoint setar o cookie).
 */
export async function followTeam(
  db: Db,
  input: { userId: string | null; teamId: number },
): Promise<FollowResult> {
  let user: User | undefined;
  let isNewUser = false;

  if (input.userId) {
    user = await db.select().from(users).where(eq(users.id, input.userId)).get();
  }
  if (!user) {
    user = await createAnonUser(db);
    isNewUser = true;
  }

  await db
    .insert(subscriptions)
    .values({ userId: user.id, teamId: input.teamId })
    .onConflictDoNothing();

  return { user, isNewUser };
}

export async function unfollowTeam(
  db: Db,
  userId: string,
  teamId: number,
): Promise<void> {
  await db
    .delete(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.teamId, teamId)),
    );
}
