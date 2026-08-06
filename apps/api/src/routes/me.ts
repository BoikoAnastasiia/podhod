import { meResponseSchema } from "@podhod/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { userSettings } from "../db/schema.js";
import type { AuthedEnv } from "../lib/session.js";
import { requireSession } from "../lib/session.js";

/**
 * The one protected route this phase ships — a demonstration of the pattern
 * (`requireSession()` middleware, session read off `c.get("session")`) that
 * a future `/programs` route copies. Not a settings editor: docs/design.md's
 * `/settings` screen (locale, units, plate increment, rest, theme, account)
 * is later work, but reading back what `user_settings` already holds proves
 * the guard and the table both work end to end.
 */
export const meRoutes = new Hono<AuthedEnv>().get("/", requireSession(), async (c) => {
  const session = c.get("session");
  const db = drizzle(c.env.DB);

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  // Every account gets a row from the signup hook (src/lib/auth.ts), so a
  // missing one here would mean that hook failed silently — surfacing as a
  // 500 is more honest than inventing defaults the database never wrote.
  if (!settings) {
    return c.json(
      {
        error: { code: "internal", message: "settings missing for this account" },
      },
      500,
    );
  }

  return c.json(
    meResponseSchema.parse({
      user: { id: session.user.id, email: session.user.email, name: session.user.name },
      settings: {
        locale: settings.locale,
        units: settings.units,
        plateIncrementKg: settings.plateIncrementKg,
        defaultRestSeconds: settings.defaultRestSeconds,
        theme: settings.theme,
      },
    }),
  );
});
