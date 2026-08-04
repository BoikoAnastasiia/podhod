import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExerciseCard } from "../../components/ExerciseCard.js";
import { FilterChips } from "../../components/FilterChips.js";
import { useI18n } from "../../i18n/useI18n.js";
import { fetchExercises } from "../../lib/api.js";

const BODY_PARTS = [
  "back", "cardio", "chest", "lower arms", "lower legs",
  "neck", "shoulders", "upper arms", "upper legs", "waist",
];

export const Route = createFileRoute("/library/")({
  component: Library,
});

function Library() {
  const { lang, term } = useI18n();
  const [q, setQ] = useState("");
  const [bodyPart, setBodyPart] = useState<string | undefined>();

  const { data, isPending } = useQuery({
    queryKey: ["exercises", lang, q, bodyPart],
    queryFn: () => fetchExercises({ lang, q, bodyPart }),
  });

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search exercises"
        className="min-h-tap-min rounded-full bg-surface px-5 text-ink placeholder:text-muted"
      />
      <FilterChips
        options={BODY_PARTS}
        selected={bodyPart}
        onSelect={setBodyPart}
        label={term}
      />
      {isPending ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data?.items.map((exercise) => (
            <li key={exercise.id}>
              <ExerciseCard exercise={exercise} label={term} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
