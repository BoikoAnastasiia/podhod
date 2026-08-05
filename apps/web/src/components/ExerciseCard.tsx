import { mediaUrl } from "@podhod/core";
import type { ExerciseListItem } from "@podhod/schema";
import { Link } from "@tanstack/react-router";
import { captureThumb } from "../lib/flipStore.js";

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
      onClick={() => captureThumb(exercise.id)}
      /*
       * "Very subtle" — the owner's words. The lift and shadow read as a
       * gentle tactile response, not a jump; the transform half is wrapped
       * in motion-safe: so prefers-reduced-motion users still get the
       * shadow (a visual, not a motion cue) without any translate.
       */
      className="group flex min-h-row-min flex-col items-center gap-2 rounded-card bg-surface p-2 shadow-card transition-shadow duration-200 ease-out hover:shadow-card-hover motion-safe:hover:-translate-y-1"
    >
      {/*
       * Media is capped at 180x180 by licence. This frame is pinned to
       * exactly that size with overflow hidden — only the <img> inside it
       * scales on hover, so the licensed bounding box never grows past
       * 180px. e2e/library.spec.ts measures *this* frame (.exercise-thumb),
       * not the <img>, for exactly that reason.
       */}
      <span
        data-exercise-id={exercise.id}
        data-flip-id={exercise.id}
        className="exercise-thumb block size-media overflow-hidden rounded-row bg-canvas"
      >
        <img
          src={mediaUrl(exercise.imagePath)}
          alt=""
          width={180}
          height={180}
          loading="lazy"
          className="size-full object-contain transition-transform duration-200 ease-out motion-safe:group-hover:scale-103"
        />
      </span>
      <span className="text-sm font-semibold leading-tight">{exercise.name}</span>
      <span className="text-xs text-muted">
        {label(exercise.bodyPart)} · {label(exercise.equipment)}
      </span>
    </Link>
  );
}
