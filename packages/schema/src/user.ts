import { z } from "zod";
import { langSchema } from "./exercise.js";

/**
 * Mirrors apps/api/src/db/schema.ts's `user_settings` columns, per
 * docs/design.md §3. `locale` reuses `langSchema` rather than a fresh enum,
 * since a settings locale and a UI language are the same value everywhere
 * else in this app.
 */
export const userSettingsSchema = z.object({
  locale: langSchema,
  units: z.enum(["kg", "lb"]),
  plateIncrementKg: z.number().positive(),
  defaultRestSeconds: z.number().int().nonnegative(),
  theme: z.enum(["light", "dark", "system"]),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

/**
 * `GET /api/me` — the one route this phase protects, to demonstrate the
 * session-required pattern a future `/programs` route reuses.
 */
export const meResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
  }),
  settings: userSettingsSchema,
});
export type MeResponse = z.infer<typeof meResponseSchema>;
