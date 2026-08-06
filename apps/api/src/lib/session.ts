import type { ErrorResponse } from "@podhod/schema";
import { errorResponseSchema } from "@podhod/schema";
import type { MiddlewareHandler } from "hono";
import { createAuth } from "./auth.js";

type Env = { Bindings: { DB: D1Database; BETTER_AUTH_SECRET: string } };

/**
 * `Awaited<ReturnType<...>>` rather than a hand-written type: Better Auth's
 * session shape (which fields `user` and `session` carry) is derived from
 * the plugin config, and hand-copying it here would drift the moment a
 * plugin changes it.
 */
type MaybeSession = Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>;
export type Session = NonNullable<MaybeSession>;

/** The context shape any route behind `requireSession()` is guaranteed. */
export type AuthedEnv = Env & { Variables: { session: Session } };

/**
 * Takes only what it needs (`env` and the raw request) rather than a full
 * Hono `Context`, deliberately — a `Context<Env>` parameter would reject a
 * `Context<AuthedEnv>` caller below, since Hono's `Context` is invariant
 * over its `Variables`. This shape is a supertype either caller satisfies.
 */
export async function getSession(c: {
  env: Env["Bindings"];
  req: { url: string; raw: Request };
}): Promise<MaybeSession> {
  const auth = createAuth(c.env, c.req.url);
  return auth.api.getSession({ headers: c.req.raw.headers });
}

/**
 * The mechanism a future `/programs` (or any session-only) route reuses:
 * reject with the shared error envelope before the handler runs, or attach
 * the session to context so the handler doesn't have to look it up again.
 * Demonstrated today on `/api/me` — the library and its routes never call
 * this, by design (docs/design.md: the library stays public).
 */
export function requireSession(): MiddlewareHandler<AuthedEnv> {
  return async (c, next) => {
    const session = await getSession(c);
    if (!session) {
      return c.json(
        errorResponseSchema.parse({
          error: { code: "unauthorized", message: "sign in required" },
        } satisfies ErrorResponse),
        401,
      );
    }
    c.set("session", session);
    await next();
  };
}
