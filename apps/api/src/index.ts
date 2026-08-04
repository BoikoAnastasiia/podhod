/**
 * Placeholder Worker entry point. `wrangler.jsonc` names this file as `main`,
 * and the Vitest pool refuses to start without it. The API routes land here in
 * a later task; until then every request that reaches the Worker (only
 * `/api/*`, per `run_worker_first`) is a route that does not exist yet.
 */
export default {
  fetch: () => new Response("Not Found", { status: 404 }),
} satisfies ExportedHandler<Env>;
