import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ExerciseCard } from "../../components/ExerciseCard.js";
import { FilterChips } from "../../components/FilterChips.js";
import { useI18n } from "../../i18n/useI18n.js";
import { fetchExercises } from "../../lib/api.js";
import { BODY_PARTS } from "../../lib/bodyParts.js";

/**
 * Placeholders in the shape of the results they stand in for.
 *
 * The loading state used to be one line of text. On a slow connection that
 * makes the page a few hundred pixels tall, so the footer sits in the middle of
 * the screen and is then shoved below the fold when the grid arrives — measured
 * at 0.20 cumulative layout shift for a single navigation into this page, the
 * whole of it attributed to the footer moving twice.
 *
 * Reserving the space costs nothing and removes the jolt. The count only has to
 * fill a viewport; beyond that the footer is already off-screen and further
 * growth is invisible.
 */
function LoadingGrid({ label }: { label: string }) {
  return (
    <>
      <p className="sr-only" role="status">
        {label}
      </p>
      <ul aria-hidden="true" className="grid grid-exercises gap-3" data-testid="library-skeleton">
        {Array.from({ length: 12 }, (_, index) => (
          <li
            key={index}
            className="flex min-h-row-min flex-col items-center gap-2 rounded-card bg-surface p-2 shadow-card"
          >
            <span className="block size-media rounded-row bg-canvas motion-safe:animate-pulse" />
            <span className="h-4 w-3/4 rounded-full bg-canvas motion-safe:animate-pulse" />
            <span className="h-3 w-1/2 rounded-full bg-canvas motion-safe:animate-pulse" />
          </li>
        ))}
      </ul>
    </>
  );
}

/** What the location carries about a browse. Both parts are optional. */
type LibrarySearch = { q?: string; bodyPart?: string };

export const Route = createFileRoute("/library/")({
  /**
   * The search term and the body-part chip live in the URL, not in component
   * state.
   *
   * They used to be `useState`, and opening an exercise threw them away:
   * `/library/$id` is a different route, so React unmounts this one on the way
   * out and remounts it empty on the way back. The owner would filter to
   * «Грудь», page down, open something, press Back — and land on page one of
   * the unfiltered library.
   *
   * Restoring the pages falls out of restoring the filter: the infinite
   * query's key is built from `q` and `bodyPart`, so bringing them back
   * identical makes React Query hand over every page it already holds instead
   * of starting a new query at the first cursor.
   *
   * The URL rather than session history, for the reason `$id`'s `?from=`
   * gives: a browse worth keeping is also worth reloading, bookmarking and
   * sending to someone.
   *
   * Both values are re-validated on the way in, because anyone can type a URL:
   * `q` is capped at the 100 characters the API accepts, and `bodyPart` has to
   * be one of the ten real taxonomy values or it is dropped — `?bodyPart=elbows`
   * would otherwise reach the API and render as "nothing matches those filters"
   * with no chip lit to explain why, and no way back except editing the URL.
   *
   * Rejection has to be spelled `undefined`, not an omitted key. The router
   * merges this result *onto* the raw parsed search rather than replacing it
   * (`Object.assign` in router-core), so a key this function leaves out keeps
   * whatever the URL said — returning `{}` for a bad value rejects nothing at
   * all. Writing `undefined` overwrites it, and the router drops undefined
   * values when it serialises the URL again, so a clean browse stays a clean
   * `/library`.
   */
  validateSearch: (search: Record<string, unknown>): LibrarySearch => {
    const q = typeof search.q === "string" ? search.q.slice(0, 100) : "";
    const bodyPart = typeof search.bodyPart === "string" ? search.bodyPart : "";
    return {
      q: q || undefined,
      bodyPart: BODY_PARTS.includes(bodyPart) ? bodyPart : undefined,
    };
  },
  component: Library,
});

function Library() {
  const { lang, term, t } = useI18n();
  const { q = "", bodyPart } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  /*
   * `replace` throughout: typing six letters into the search box must not bury
   * the page the owner came from under six history entries she has to press
   * Back through. The browse is a property of where she is, not a place of its
   * own — so the entry is rewritten in place, and Back still means "leave the
   * library", while returning to it from an exercise restores exactly the
   * browse she left.
   */
  const setSearch = (next: LibrarySearch) => void navigate({ search: next, replace: true });

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
    /* The grid holds its last results while the next filter loads, for the
       same reason the picker does — see the note there. */
    placeholderData: keepPreviousData,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="flex flex-col gap-4 py-8">
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
          onChange={(e) => setSearch({ q: e.target.value, bodyPart })}
          placeholder={t("library.search")}
          aria-label={t("library.search")}
          className="min-h-tap-min w-full rounded-full border-2 border-border bg-surface pl-10 pr-5 text-ink shadow-search transition-colors duration-150 placeholder:text-muted"
        />
      </div>
      <FilterChips
        options={BODY_PARTS}
        selected={bodyPart}
        onSelect={(next) => setSearch({ q, bodyPart: next })}
        label={term}
      />
      {isPending ? (
        <LoadingGrid label={t("library.loading")} />
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
