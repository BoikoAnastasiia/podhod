import type { ErrorResponse } from "@podhod/schema";
import { Hono } from "hono";
import { exerciseRoutes } from "./routes/exercises.js";

type Env = { Bindings: { DB: D1Database; ASSETS: Fetcher } };

const app = new Hono<Env>();

app.route("/api/exercises", exerciseRoutes);

/**
 * `run_worker_first: ["/api/*"]` means only API paths reach the Worker before
 * the asset layer, so anything arriving here that is not /api/* is a client
 * route and belongs to the SPA. API misses stay JSON.
 */
app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
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
