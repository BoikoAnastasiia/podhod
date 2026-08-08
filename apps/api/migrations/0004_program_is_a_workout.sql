-- A program is one workout: exercises attach to the program directly and the
-- days tier goes away. Hand-written, like 0002 and 0003 — never regenerate.
--
-- The rebuild pattern (new table, copy, drop, rename) instead of ALTER:
-- program_day_id is indexed and carries a foreign key, both of which SQLite's
-- DROP COLUMN refuses to remove. Positions renumber day-order-then-exercise-
-- order, so a program that had several days keeps a meaningful sequence.
CREATE TABLE `program_exercises_new` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`scheme_type` text NOT NULL,
	`scheme_config` text NOT NULL,
	`rest_seconds` integer,
	`notes` text,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `program_exercises_new`
	(`id`, `program_id`, `exercise_id`, `position`, `scheme_type`, `scheme_config`, `rest_seconds`, `notes`)
SELECT pe.`id`, pd.`program_id`, pe.`exercise_id`,
	ROW_NUMBER() OVER (PARTITION BY pd.`program_id` ORDER BY pd.`position`, pe.`position`) - 1,
	pe.`scheme_type`, pe.`scheme_config`, pe.`rest_seconds`, pe.`notes`
FROM `program_exercises` pe JOIN `program_days` pd ON pd.`id` = pe.`program_day_id`;
--> statement-breakpoint
DROP TABLE `program_exercises`;
--> statement-breakpoint
ALTER TABLE `program_exercises_new` RENAME TO `program_exercises`;
--> statement-breakpoint
CREATE INDEX `idx_program_exercises_program` ON `program_exercises` (`program_id`,`position`);
--> statement-breakpoint
DROP TABLE `program_days`;
