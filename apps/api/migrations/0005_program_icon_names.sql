-- Hand-written, like 0002-0004: drizzle-kit generate rebuilds state from its
-- snapshots (which stop at 0002) and would drop what it does not model.
-- Wrangler applies migration files in name order regardless of who wrote them.
--
-- Icons stop being emoji and become names from the muscle-group sprite. Each of
-- the ten emoji the old picker offered maps to the nearest glyph in the new
-- set, so no user loses the choice they made. Anything else — an emoji from an
-- older build, or a value written by hand — is left alone; the client renders
-- an unknown name as no icon rather than as a broken glyph.
ALTER TABLE `programs` ADD COLUMN `icon_color` text;

UPDATE `programs` SET `icon` = CASE `icon`
  WHEN '💪' THEN 'biceps'
  WHEN '🦵' THEN 'quads'
  WHEN '🍑' THEN 'core'
  WHEN '🏋️' THEN 'chest'
  WHEN '🤸' THEN 'shoulders'
  WHEN '🏃' THEN 'calves'
  WHEN '⚡' THEN 'forearms'
  WHEN '🔥' THEN 'back'
  WHEN '🧘' THEN 'neck'
  WHEN '❤️' THEN 'cardio'
  ELSE `icon`
END
WHERE `icon` IS NOT NULL;
