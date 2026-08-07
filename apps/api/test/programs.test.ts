import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./helpers.js";

/**
 * Foreign keys point at `user`, so a program needs an owner to exist. Two of
 * them, because the one-active-per-user rule is only meaningful if it is scoped
 * per user rather than globally.
 */
const seedUsers = async () => {
  for (const id of ["user-1", "user-2"]) {
    await env.DB.prepare(
      "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?,?,?,0,0,0)",
    )
      .bind(id, id, `${id}@example.test`)
      .run();
  }
};

const insertProgram = (id: string, userId: string, isActive: number) =>
  env.DB.prepare(
    "INSERT INTO programs (id, user_id, name, is_active, created_at) VALUES (?,?,?,?,1)",
  )
    .bind(id, userId, id, isActive)
    .run();

beforeAll(async () => {
  await applyMigrations(env.DB);
  await seedUsers();
});

describe("the one-active-program rule", () => {
  /**
   * The rule lives in a partial unique index rather than a handler check,
   * because two concurrent activations both pass an application-level "is
   * anything else active?" query and both write. The database is the only
   * place that can actually refuse the second one — so this asserts the index
   * reached the database, not that a handler remembered to look.
   */
  it("refuses a second active program for the same user", async () => {
    await insertProgram("p-active", "user-1", 1);
    await expect(insertProgram("p-second", "user-1", 1)).rejects.toThrow();
  });

  it("allows any number of inactive programs alongside the active one", async () => {
    await insertProgram("p-idle-1", "user-1", 0);
    await insertProgram("p-idle-2", "user-1", 0);

    const { results } = await env.DB.prepare(
      "SELECT id FROM programs WHERE user_id = 'user-1'",
    ).all();
    expect(results.map((r) => r.id).sort()).toEqual(["p-active", "p-idle-1", "p-idle-2"]);
  });

  it("scopes the rule per user rather than globally", async () => {
    // user-1 already has an active program; user-2 having one too is correct.
    await insertProgram("p-other-user", "user-2", 1);

    const { results } = await env.DB.prepare(
      "SELECT user_id FROM programs WHERE is_active = 1 ORDER BY user_id",
    ).all();
    expect(results.map((r) => r.user_id)).toEqual(["user-1", "user-2"]);
  });
});

describe("program cascades", () => {
  it("removes a program's days and their exercises when the program goes", async () => {
    await env.DB.prepare(
      "INSERT INTO exercises (id, body_part, equipment, target, muscle_group, secondary_muscles, media_id, image_path, gif_path) VALUES ('e1','waist','body weight','abs','core','[]','m','i.jpg','g.gif')",
    ).run();
    await insertProgram("p-cascade", "user-2", 0);
    await env.DB.prepare(
      "INSERT INTO program_days (id, program_id, position, name) VALUES ('d1','p-cascade',0,'Push')",
    ).run();
    await env.DB.prepare(
      "INSERT INTO program_exercises (id, program_day_id, exercise_id, position, scheme_type, scheme_config) VALUES ('pe1','d1','e1',0,'fixed','{}')",
    ).run();

    await env.DB.prepare("DELETE FROM programs WHERE id = 'p-cascade'").run();

    const days = await env.DB.prepare(
      "SELECT id FROM program_days WHERE program_id = 'p-cascade'",
    ).all();
    const entries = await env.DB.prepare(
      "SELECT id FROM program_exercises WHERE program_day_id = 'd1'",
    ).all();
    // Two levels of cascade: the day goes with the program, and the exercise
    // goes with the day. Without the second, deleting a program would leave
    // orphaned program_exercises rows pointing at nothing.
    expect(days.results).toHaveLength(0);
    expect(entries.results).toHaveLength(0);
  });
});
