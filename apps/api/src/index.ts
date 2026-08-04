import { Hono } from "hono";
import { exerciseRoutes } from "./routes/exercises.js";

type Env = { Bindings: { DB: D1Database; ASSETS: Fetcher } };

const app = new Hono<Env>();

app.route("/api/exercises", exerciseRoutes);

app.notFound((c) =>
  c.json({ error: { code: "not_found", message: "no such route" } }, 404),
);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: { code: "internal", message: "unexpected error" } }, 500);
});

export default app;
