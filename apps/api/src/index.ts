import type { ErrorResponse } from "@podhod/schema";
import { Hono } from "hono";
import { createAuth } from "./lib/auth.js";
import { validateAuthBody } from "./lib/authValidation.js";
import { exerciseRoutes } from "./routes/exercises.js";
import { meRoutes } from "./routes/me.js";

type Env = {
  Bindings: {
    DB: D1Database;
    ASSETS: Fetcher;
    BETTER_AUTH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
  };
};

const app = new Hono<Env>();

/**
 * Better Auth owns everything under here — sign-up, sign-in, sign-out,
 * session lookup. Mounted with `app.on` (not `.route`) because its own
 * handler already does its internal routing for GET and POST; Hono only
 * needs to hand it the raw request. Built per-request via createAuth, not
 * once at module scope — see that function's own comment for why.
 */
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  // The real server-side gate for the sign-in/sign-up forms — see
  // lib/authValidation.ts. Runs before Better Auth's own handler ever sees
  // the request, so a caller that bypasses apps/web's client-side check
  // gets the same shared error envelope every other route in this app uses.
  const validationError = await validateAuthBody(c.req.raw);
  if (validationError) {
    return c.json(validationError, 400);
  }
  const auth = createAuth(c.env, c.req.url);
  return auth.handler(c.req.raw);
});

app.route("/api/exercises", exerciseRoutes);
app.route("/api/me", meRoutes);

/**
 * `run_worker_first: ["/api/*"]` means only API paths reach the Worker before
 * the asset layer, so anything arriving here that is not /api/* is a client
 * route and belongs to the SPA. API misses stay JSON.
 */
app.notFound((c) => {
  if (c.req.path === "/api" || c.req.path.startsWith("/api/")) {
    return c.json(
      { error: { code: "not_found", message: "no such route" } } satisfies ErrorResponse,
      404,
    );
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  console.error(err);
  return c.json(
    { error: { code: "internal", message: "unexpected error" } } satisfies ErrorResponse,
    500,
  );
});

export default app;
