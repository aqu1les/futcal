import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

// Usuário anônimo, criado na primeira seleção de times. Sem dados pessoais no MVP.
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // uuid opaco (cookie httpOnly)
  calToken: text('cal_token').notNull().unique(), // credencial do feed .ics
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Time com id INTERNO (nosso). O id da fonte externa fica em team_sources.
export const teams = sqliteTable(
  'teams',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    // Nome normalizado (minúsculo, sem acento) pra busca acento-insensível.
    searchName: text('search_name').notNull(),
    logo: text('logo'),
    country: text('country'),
  },
  (t) => [index('idx_teams_search').on(t.searchName)],
);

// Mapa id interno → (fonte, id externo). Uma linha por fonte suporta múltiplas
// fontes por time (a "relação" para outras fontes já nasce aqui).
export const teamSources = sqliteTable(
  'team_sources',
  {
    source: text('source').notNull(), // ex: 'espn'
    externalId: text('external_id').notNull(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.source, t.externalId] }),
    index('idx_team_sources_team').on(t.teamId),
  ],
);

// N:N entre users e teams (id interno).
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

// Jogo. Id INTERNO; a origem fica em (source, external_id). home/away guardam o
// nome (display) e o id interno do time quando conhecido (null pro adversário
// que não está no nosso banco).
export const fixtures = sqliteTable(
  'fixtures',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    home: text('home').notNull(),
    away: text('away').notNull(),
    homeTeamId: integer('home_team_id').references(() => teams.id, {
      onDelete: 'set null',
    }),
    awayTeamId: integer('away_team_id').references(() => teams.id, {
      onDelete: 'set null',
    }),
    competition: text('competition').notNull(),
    round: text('round'),
    venue: text('venue'),
    startsAt: integer('starts_at', { mode: 'timestamp' }).notNull(),
    status: text('status').notNull(), // ex: STATUS_SCHEDULED, STATUS_POSTPONED
    // Incrementa quando starts_at OU status mudam. Vira o SEQUENCE do VEVENT.
    revision: integer('revision').notNull().default(0),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    unique('uq_fixtures_source').on(t.source, t.externalId),
    index('idx_fixtures_starts_at').on(t.startsAt),
    index('idx_fixtures_home').on(t.homeTeamId),
    index('idx_fixtures_away').on(t.awayTeamId),
  ],
);

export type Fixture = typeof fixtures.$inferSelect;
export type NewFixture = typeof fixtures.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type User = typeof users.$inferSelect;
