import { env, SELF } from "cloudflare:test";
import { applyMigrations } from "./helpers.js";

/**
 * Better Auth checks the request's Origin against its baseURL for
 * state-changing endpoints, and `createAuth` derives baseURL from the
 * request's own origin, so using one origin throughout is what makes them
 * match — exactly as a same-origin browser request would.
 */
export const ORIGIN = "https://example.com";
export const jsonHeaders = { "content-type": "application/json", origin: ORIGIN };

/**
 * `SELF.fetch` has no cookie jar, so a session has to be carried by hand:
 * this reduces a response's Set-Cookie headers to the single Cookie header the
 * next request needs.
 */
export function cookieHeaderFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

/** A signed-in caller. Every program route requires one. */
export async function signUpAs(email: string): Promise<string> {
  const res = await SELF.fetch(`${ORIGIN}/api/auth/sign-up/email`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, password: "correct-horse-1", name: email }),
  });
  if (res.status !== 200) {
    throw new Error(`sign-up failed for ${email}: ${res.status} ${await res.text()}`);
  }
  const cookie = cookieHeaderFrom(res);
  if (!cookie) throw new Error(`sign-up returned no session cookie for ${email}`);
  return cookie;
}

type Json = Record<string, unknown> | unknown[];

export function api(cookie: string) {
  const call = (method: string) => async (path: string, body?: Json): Promise<Response> =>
    SELF.fetch(`${ORIGIN}${path}`, {
      method,
      headers: { ...jsonHeaders, cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  return {
    get: call("GET"),
    post: call("POST"),
    patch: call("PATCH"),
    put: call("PUT"),
    delete: call("DELETE"),
    async json<T>(res: Response): Promise<T> {
      if (!res.ok) throw new Error(`expected ok, got ${res.status}: ${await res.text()}`);
      return (await res.json()) as T;
    },
  };
}

/**
 * The library rows a program can point at. Only the columns the program API
 * reads back are meaningful; the rest satisfy NOT NULL.
 */
export async function seedExercises(
  ids: string[],
  /**
   * Defaults to a barbell chest movement, which every weight-based scheme
   * suits. Pass something else to exercise the load-profile rules — a
   * body-weight or cardio row rejects a prescription written in kilograms.
   */
  taxonomy: { bodyPart: string; equipment: string } = { bodyPart: "chest", equipment: "barbell" },
): Promise<void> {
  for (const id of ids) {
    await env.DB.prepare(
      "INSERT INTO exercises (id, body_part, equipment, target, muscle_group, secondary_muscles, media_id, image_path, gif_path) VALUES (?,?,?,'pectorals','chest','[]','m',?,'g.gif')",
    )
      .bind(id, taxonomy.bodyPart, taxonomy.equipment, `images/${id}.jpg`)
      .run();
    await env.DB.prepare(
      "INSERT INTO exercise_translations (exercise_id, lang, name, steps, search_text) VALUES (?,'en',?,'[\"step\"]',?)",
    )
      .bind(id, `exercise ${id}`, `exercise ${id}`)
      .run();
    await env.DB.prepare(
      "INSERT INTO exercise_translations (exercise_id, lang, name, steps, search_text) VALUES (?,'ru',?,'[\"шаг\"]',?)",
    )
      .bind(id, `упражнение ${id}`, `упражнение ${id}`)
      .run();
  }
}

export async function setUpSchema(exerciseIds: string[] = []): Promise<void> {
  await applyMigrations(env.DB);
  if (exerciseIds.length > 0) await seedExercises(exerciseIds);
}

export const LINEAR = {
  kind: "linear",
  sets: 3,
  reps: 5,
  incrementKg: 2.5,
  failuresBeforeDeload: 3,
  deloadPct: 0.1,
} as const;

export const DOUBLE = {
  kind: "double",
  sets: 3,
  repLow: 8,
  repHigh: 12,
  incrementKg: 2.5,
} as const;

export const RPE = {
  kind: "rpe",
  sets: 3,
  reps: 5,
  targetRpe: 8,
  adjustPct: 0.05,
} as const;

export const FIXED = { kind: "fixed", sets: 3, reps: 10, weightKg: 60 } as const;

export const ALL_SCHEMES = [FIXED, LINEAR, DOUBLE, RPE] as const;
