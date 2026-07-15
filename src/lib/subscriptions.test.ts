import { env } from 'cloudflare:test';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db';
import { subscriptions, teams, users } from '../db/schema';
import { followTeam, unfollowTeam } from './subscriptions';

const db = getDb(env);

let fluId: number;

beforeEach(async () => {
  await db.delete(subscriptions);
  await db.delete(users);
  await db.delete(teams);
  [{ id: fluId }] = await db
    .insert(teams)
    .values({ name: 'Fluminense', searchName: 'fluminense', logo: null, country: null })
    .returning({ id: teams.id });
});

describe('followTeam', () => {
  it('cria usuário anônimo com token e a subscription', async () => {
    const { user, isNewUser } = await followTeam(db, { userId: null, teamId: fluId });

    expect(isNewUser).toBe(true);
    expect(user.calToken).toBeTruthy();

    const sub = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.teamId, fluId)))
      .get();
    expect(sub).toBeTruthy();
  });

  it('reaproveita o user e é idempotente', async () => {
    const first = await followTeam(db, { userId: null, teamId: fluId });
    const second = await followTeam(db, { userId: first.user.id, teamId: fluId });

    expect(second.isNewUser).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(await db.select().from(subscriptions).all()).toHaveLength(1);
    expect(await db.select().from(users).all()).toHaveLength(1);
  });
});

describe('unfollowTeam', () => {
  it('remove a subscription', async () => {
    const { user } = await followTeam(db, { userId: null, teamId: fluId });
    await unfollowTeam(db, user.id, fluId);
    expect(await db.select().from(subscriptions).all()).toHaveLength(0);
  });
});
