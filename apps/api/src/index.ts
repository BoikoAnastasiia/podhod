import type { ErrorResponse } from "@podhod/schema";
import { Hono } from "hono";
import { exerciseRoutes } from "./routes/exercises.js";

type Env = { Bindings: { DB: D1Database; ASSETS: Fetcher } };

const app = new Hono<Env>();

app.route("/api/exercises", exerciseRoutes);

app.notFound((c) =>
  c.json(
    { error: { code: "not_found", message: "no such route" } } satisfies ErrorResponse,
    404,
  ),
);

app.onError((err, c) => {
  console.error(err);
  return c.json(
    { error: { code: "internal", message: "unexpected error" } } satisfies ErrorResponse,
    500,
  );
});

export default app;
