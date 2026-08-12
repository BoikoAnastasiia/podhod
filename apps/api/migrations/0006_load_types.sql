-- Hand-written, like 0002-0005: drizzle-kit generate rebuilds state from its
-- snapshots (which stop at 0002) and would drop what it does not model.
--
-- Every exercise used to arrive as `fixed` 4×10 · 20 kg, whatever it was. For
-- the 451 movements in this library that carry no external load, that weight
-- was fiction — most visibly "walk elliptical cross trainer · 20 kg". Schemes
-- now come in kinds that suit the movement, and these are the rows written
-- before that was true.
--
-- The classification must match packages/core/src/loadProfile.ts exactly. It is
-- restated here rather than shared because a migration has to keep meaning what
-- it meant on the day it ran: this file is a record of what happened to the
-- data, and later edits to the TypeScript must not silently rewrite history.
--
-- Only `fixed` rows are converted. A user who deliberately chose linear or RPE
-- on a body-weight movement made a stranger choice than the default did, and
-- rewriting a deliberate prescription is worse than leaving an odd one.

-- Cardio machines: time, never reps. Sets are kept; the 20 kg and the rep count
-- both go, replaced by twenty minutes — the same default a new one now gets.
UPDATE `program_exercises`
SET
  `scheme_type` = 'duration',
  `scheme_config` = json_object(
    'kind', 'duration',
    'sets', json_extract(`scheme_config`, '$.sets'),
    'seconds', 1200
  )
WHERE `scheme_type` = 'fixed'
  AND `exercise_id` IN (
    SELECT `id` FROM `exercises`
    WHERE `equipment` IN (
      'elliptical machine', 'stationary bike', 'stepmill machine', 'upper body ergometer'
    )
  );

-- Body-powered cardio — burpees, running, jump rope. Time is the default for a
-- new one, and these keep their sets for the same reason as above.
UPDATE `program_exercises`
SET
  `scheme_type` = 'duration',
  `scheme_config` = json_object(
    'kind', 'duration',
    'sets', json_extract(`scheme_config`, '$.sets'),
    'seconds', 1200
  )
WHERE `scheme_type` = 'fixed'
  AND `exercise_id` IN (SELECT `id` FROM `exercises` WHERE `body_part` = 'cardio');

-- Everything else that is not loaded in kilograms: body weight, bands, assisted
-- machines, balls, ropes, rollers. Sets and reps were always meaningful here —
-- only the weight was invented, so only the weight is dropped.
UPDATE `program_exercises`
SET
  `scheme_type` = 'bodyweight',
  `scheme_config` = json_object(
    'kind', 'bodyweight',
    'sets', json_extract(`scheme_config`, '$.sets'),
    'reps', json_extract(`scheme_config`, '$.reps'),
    'addedWeightKg', 0
  )
WHERE `scheme_type` = 'fixed'
  AND `exercise_id` IN (
    SELECT `id` FROM `exercises`
    WHERE `equipment` NOT IN (
      'barbell', 'cable', 'dumbbell', 'ez barbell', 'hammer', 'kettlebell',
      'leverage machine', 'medicine ball', 'olympic barbell', 'skierg machine',
      'sled machine', 'smith machine', 'trap bar', 'weighted'
    )
  );
