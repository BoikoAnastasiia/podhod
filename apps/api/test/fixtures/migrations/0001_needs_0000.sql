-- Indexing a table created by 0000 fails outright unless that migration ran
-- first, which makes this file an assertion about ordering.
CREATE INDEX `idx_needs_0000` ON `commented` (`id`);
