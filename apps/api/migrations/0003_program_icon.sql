-- Hand-written, like 0002's partial index: drizzle-kit generate would try to
-- rebuild state from its snapshots and drop what it does not model. Wrangler
-- applies migration files in name order regardless of who wrote them.
ALTER TABLE `programs` ADD COLUMN `icon` text;
