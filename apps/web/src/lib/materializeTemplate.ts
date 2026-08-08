import type { Lang } from "@podhod/schema";
import type { ProgramTemplate } from "../data/programTemplates.js";
import { addExercise, createDay, createProgram } from "./api.js";

/**
 * Replays a template through the same three endpoints the hand-building flow
 * uses, in the visitor's language. Sequential on purpose: day and exercise
 * order is positional server-side, and firing the creates concurrently would
 * race the positions. ~20 requests against the Worker is imperceptible.
 *
 * No rollback on mid-sequence failure — the partial program is visible and
 * deletable, which is a better failure mode than invisible cleanup logic
 * quietly destroying rows.
 */
export async function materializeTemplate(
  template: ProgramTemplate,
  lang: Lang,
): Promise<string> {
  const programId = await createProgram({
    name: template.name[lang],
    notes: null,
    icon: template.icon,
  });
  if (!programId) throw new Error("internal");

  for (const day of template.days) {
    const dayId = await createDay(programId, day.name[lang]);
    if (!dayId) throw new Error("internal");
    for (const exercise of day.exercises) {
      await addExercise(dayId, exercise);
    }
  }
  return programId;
}
