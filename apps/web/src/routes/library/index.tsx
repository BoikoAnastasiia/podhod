import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExerciseCard } from "../../components/ExerciseCard.js";
import { FilterChips } from "../../components/FilterChips.js";
import { useI18n } from "../../i18n/useI18n.js";
import { fetchExercises } from "../../lib/api.js";
import { BODY_PARTS } from "../../lib/bodyParts.js";

export const Route = createFileRoute("/library/")({
  component: Library,
});

function Library() {
  const { lang, term, t } = useI18n();
  const [q, setQ] = useState("");
  const [bodyPart, setBodyPart] = useState<string | undefined>();

  // The query key carries q and bodyPart, so changing either starts a fresh
  // paginated query rather than appending to the previous filter's pages.
  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["exercises", lang, q, bodyPart],
    queryFn: ({ pageParam }) => fetchExercises({ lang, q, bodyPart, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        {/* Decorative — the input carries its own aria-label. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
        >
          <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <line
            x1="13"
            y1="13"
            x2="17"
            y2="17"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("library.search")}
          aria-label={t("library.search")}
          className="min-h-tap-min w-full rounded-full border-2 border-border bg-surface pl-10 pr-5 text-ink shadow-search outline-none transition-colors duration-150 placeholder:text-muted focus:border-accent"
        />
      </div>
      <FilterChips
        options={BODY_PARTS}
        selected={bodyPart}
        onSelect={setBodyPart}
        label={term}
      />
      {isPending ? (
        <p className="text-muted">{t("library.loading")}</p>
      ) : isError ? (
        <div className="flex flex-col items-start gap-3">
          {/* The one place accent-red belongs today: the error state. */}
          <p className="text-error">{t("library.error")}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-tap-min rounded-full border border-error bg-surface px-5 text-sm font-medium text-error"
          >
            {t("library.retry")}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted">{t("library.empty")}</p>
      ) : (
        <>
          <ul className="grid grid-exercises gap-3">
            {items.map((exercise) => (
              <li key={exercise.id}>
                <ExerciseCard exercise={exercise} label={term} />
              </li>
            ))}
          </ul>
          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="min-h-tap-min w-max self-center rounded-full bg-surface px-6 text-sm font-medium text-ink"
            >
              {isFetchingNextPage ? t("library.loading") : t("library.loadMore")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
