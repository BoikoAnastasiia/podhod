CREATE TABLE `program_days` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_program_days_program` ON `program_days` (`program_id`,`position`);--> statement-breakpoint
CREATE TABLE `program_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`program_day_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`scheme_type` text NOT NULL,
	`scheme_config` text NOT NULL,
	`rest_seconds` integer,
	`notes` text,
	FOREIGN KEY (`program_day_id`) REFERENCES `program_days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_program_exercises_day` ON `program_exercises` (`program_day_id`,`position`);--> statement-breakpoint
CREATE TABLE `programs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`is_active` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_programs_user` ON `programs` (`user_id`);--> statement-breakpoint
-- Hand-written: drizzle-kit does not emit partial indexes, so regenerating
-- this migration will drop it. At most one active program per user, enforced
-- here rather than in a handler because two concurrent activations both pass
-- an application-level "is anything else active?" query and both write. Only
-- a unique index can refuse the second one.
CREATE UNIQUE INDEX `idx_programs_one_active_per_user`
  ON `programs` (`user_id`) WHERE `is_active` = 1;