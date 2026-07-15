CREATE TABLE `fixtures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`home` text NOT NULL,
	`away` text NOT NULL,
	`home_team_id` integer,
	`away_team_id` integer,
	`competition` text NOT NULL,
	`round` text,
	`venue` text,
	`starts_at` integer NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`home_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`away_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_fixtures_starts_at` ON `fixtures` (`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_fixtures_home` ON `fixtures` (`home_team_id`);--> statement-breakpoint
CREATE INDEX `idx_fixtures_away` ON `fixtures` (`away_team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_fixtures_source` ON `fixtures` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`user_id` text NOT NULL,
	`team_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `team_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `team_sources` (
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`team_id` integer NOT NULL,
	PRIMARY KEY(`source`, `external_id`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_team_sources_team` ON `team_sources` (`team_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`search_name` text NOT NULL,
	`logo` text,
	`country` text
);
--> statement-breakpoint
CREATE INDEX `idx_teams_search` ON `teams` (`search_name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`cal_token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_cal_token_unique` ON `users` (`cal_token`);