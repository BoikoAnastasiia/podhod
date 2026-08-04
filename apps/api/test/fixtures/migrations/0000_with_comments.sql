-- Fixture, not part of the real schema. drizzle-kit emits no line comments, but
-- hand-written and third-party migrations do, and a naive splitter that
-- flattens newlines turns everything after a `--` into part of the comment.
CREATE TABLE `commented` (
	`id` text PRIMARY KEY NOT NULL, -- this comment must not swallow the next line
	`kept` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_commented_kept` ON `commented` (`kept`);
