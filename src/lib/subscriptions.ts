import { and, eq } from 'drizzle-orm';
import type { Db } from '../db';
import { subscriptions, teams, users } from '../db/schema';
import type { User } from '../db/schema';
import { createAnonUser } from './users';

export interface TeamInput {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
}

export interface FollowResult {
  user: User;
  isNewUser: boolean;
}

/**
 * Segue um time. Cria o usuário anônimo se ainda não existir, garante o registro
 * local do time e insere a subscription (idempotente). Retorna o user e se ele
 * acabou de ser criado (pra o endpoint decidir setar o cookie).
 */
export async function followTeam(
  db: Db,
  input: { userId: string | null; team: TeamInput },
): Promise<FollowResult> {
  let user: User | undefined;
  let isNewUser = false;

  if (input.userId) {
    user = await db
      .select()
      .from(users)
      .where(eq(users.id, input.userId))
      .get();
  }
  if (!user) {
    user = await createAnonUser(db);
    isNewUser = true;
  }

  await db
    .insert(teams)
    .values({
      id: input.team.id,
      name: input.team.name,
      logo: input.team.logo,
      country: input.team.country,
    })
    .onConflictDoUpdate({
      target: teams.id,
      set: {
        name: input.team.name,
        logo: input.team.logo,
        country: input.team.country,
      },
    });

  await db
    .insert(subscriptions)
    .values({ userId: user.id, teamId: input.team.id })
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
