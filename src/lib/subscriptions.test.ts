import { env } from 'cloudflare:test';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db';
import { subscriptions, teams, users } from '../db/schema';
import { followTeam, unfollowTeam } from './subscriptions';

const db = getDb(env);

const fluminense = {
  id: 124,
  name: 'Fluminense',
  logo: 'https://media.api-sports.io/football/teams/124.png',
  country: 'Brazil',
};

beforeEach(async () => {
  await db.delete(subscriptions);
  await db.delete(users);
  await db.delete(teams);
});

describe('followTeam', () => {
  it('cria usuário anônimo com token quando não há user ainda', async () => {
    const { user, isNewUser } = await followTeam(db, {
      userId: null,
      team: fluminense,
    });

    expect(isNewUser).toBe(true);
    expect(user.id).toBeTruthy();
    expect(user.calToken).toBeTruthy();
    expect(user.calToken).not.toBe(user.id);

    const persisted = await db.select().from(users).where(eq(users.id, user.id)).get();
    expect(persisted?.calToken).toBe(user.calToken);
  });

  it('cria o team local e a subscription', async () => {
    const { user } = await followTeam(db, { userId: null, team: fluminense });

    const team = await db.select().from(teams).where(eq(teams.id, 124)).get();
    expect(team?.name).toBe('Fluminense');

    const sub = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.teamId, 124)))
      .get();
    expect(sub).toBeTruthy();
  });

  it('reaproveita o user existente e é idempotente ao seguir o mesmo time', async () => {
    const first = await followTeam(db, { userId: null, team: fluminense });
    const second = await followTeam(db, {
      userId: first.user.id,
      team: fluminense,
    });

    expect(second.isNewUser).toBe(false);
    expect(second.user.id).toBe(first.user.id);

    const subs = await db.select().from(subscriptions).all();
    expect(subs).toHaveLength(1);
    const allUsers = await db.select().from(users).all();
    expect(allUsers).toHaveLength(1);
  });
});

describe('unfollowTeam', () => {
  it('remove a subscription do time', async () => {
    const { user } = await followTeam(db, { userId: null, team: fluminense });
    await unfollowTeam(db, user.id, 124);

    const subs = await db.select().from(subscriptions).all();
    expect(subs).toHaveLength(0);
  });
});
