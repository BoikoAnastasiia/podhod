CREATE TABLE `exercise_translations` (
	`exercise_id` text NOT NULL,
	`lang` text NOT NULL,
	`name` text NOT NULL,
	`steps` text NOT NULL,
	`search_text` text NOT NULL,
	PRIMARY KEY(`exercise_id`, `lang`),
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_translations_search` ON `exercise_translations` (`lang`,`search_text`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`body_part` text NOT NULL,
	`equipment` text NOT NULL,
	`target` text NOT NULL,
	`muscle_group` text NOT NULL,
	`secondary_muscles` text NOT NULL,
	`media_id` text NOT NULL,
	`image_path` text NOT NULL,
	`gif_path` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_exercises_body_part` ON `exercises` (`body_part`);--> statement-breakpoint
CREATE INDEX `idx_exercises_equipment` ON `exercises` (`equipment`);--> statement-breakpoint
CREATE INDEX `idx_exercises_target` ON `exercises` (`target`);