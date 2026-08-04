import { mediaUrl } from "@podhod/core";
import type { ExerciseListItem } from "@podhod/schema";
import { Link } from "@tanstack/react-router";

export function ExerciseCard({
  exercise,
  label,
}: {
  exercise: ExerciseListItem;
  label: (term: string) => string;
}) {
  return (
    <Link
      to="/library/$id"
      params={{ id: exercise.id }}
      data-testid="exercise-card"
      className="flex min-h-row-min flex-col items-center gap-2 rounded-card bg-surface p-3"
    >
      {/* Media is capped at 180x180 by licence; the frame is fixed to match. */}
      <img
        src={mediaUrl(exercise.imagePath)}
        alt=""
        width={180}
        height={180}
        loading="lazy"
        className="exercise-thumb size-media rounded-row bg-canvas object-contain"
        data-exercise-id={exercise.id}
      />
      <span className="text-sm font-semibold leading-tight">{exercise.name}</span>
      <span className="text-xs text-muted">
        {label(exercise.bodyPart)} · {label(exercise.equipment)}
      </span>
    </Link>
  );
}
