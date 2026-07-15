import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

// Usuário anônimo, criado na primeira seleção de times. Sem dados pessoais no MVP.
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // uuid opaco (cookie httpOnly)
  calToken: text('cal_token').notNull().unique(), // credencial do feed .ics
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Time da API-Football. `id` = team.id da API-Football (sem autoincrement).
export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey({ autoIncrement: false }),
  name: text('name').notNull(),
  logo: text('logo'),
  country: text('country'),
});

// N:N entre users e teams.
export const subscriptions = sqliteTable(
  'subscriptions',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.teamId] })],
);

// Jogo. `id` = fixture.id da API-Football (sem autoincrement).
export const fixtures = sqliteTable(
  'fixtures',
  {
    id: integer('id').primaryKey({ autoIncrement: false }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    home: text('home').notNull(),
    away: text('away').notNull(),
    competition: text('competition').notNull(),
    round: text('round'),
    venue: text('venue'),
    startsAt: integer('starts_at', { mode: 'timestamp' }).notNull(),
    status: text('status').notNull(), // NS, PST, FT, etc.
    // Incrementa quando starts_at OU status mudam. Vira o SEQUENCE do VEVENT.
    revision: integer('revision').notNull().default(0),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index('idx_fixtures_team').on(t.teamId),
    index('idx_fixtures_starts_at').on(t.startsAt),
  ],
);

export type Fixture = typeof fixtures.$inferSelect;
export type NewFixture = typeof fixtures.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type User = typeof users.$inferSelect;
