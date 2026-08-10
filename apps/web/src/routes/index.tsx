import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExerciseCard } from "../components/ExerciseCard.js";
import { BLOG_POSTS } from "../data/blogPosts.js";
import { POPULAR_EXERCISE_IDS } from "../data/popularExercises.js";
import { exerciseNounForms } from "../i18n/dict.js";
import { useI18n } from "../i18n/useI18n.js";
import { fetchExercise, fetchExerciseCount } from "../lib/api.js";

/**
 * `/` today: a landing page, because there is no auth and no programs yet to
 * make a "Today" training screen meaningful. Phases 1b/2 replace this
 * component with that screen once both exist — the swap is a route-component
 * change only. Nothing here (root layout, nav, i18n) assumes the landing
 * content is permanent.
 */
export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { lang, term, t, plural } = useI18n();

  const count = useQuery({
    queryKey: ["exerciseCount"],
    queryFn: fetchExerciseCount,
  });

  /**
   * Curated rather than sampled: the row is "most popular", not "first ten
   * alphabetically". One small detail fetch per id — they cache per exercise
   * and per language, and the detail page reuses the same key shape.
   */
  const popular = useQueries({
    queries: POPULAR_EXERCISE_IDS.map((id) => ({
      queryKey: ["exercise", id, lang],
      queryFn: () => fetchExercise(id, lang),
    })),
  });
  const popularItems = popular.flatMap((query) => (query.data ? [query.data] : []));

  return (
    <div className="flex flex-col gap-8 pb-8">
      {/*
       * -mx-4 cancels <main>'s own px-4 so the wash bleeds to the layout's
       * edge; px-4 goes back on the section inside to keep the content
       * aligned with the rest of the page. No top padding above this block:
       * the wash must start flush under the black header band — the earlier
       * py-8 put a strip of bare canvas between bar and gradient, which
       * read as three unrelated layers (line, background, wash) instead of
       * one surface. The CTA is gone with the owner's blessing: the nav's
       * Library link already does that job, and the hero reads calmer as
       * wordmark + one sentence.
       */}
      {/* Tight on purpose (owner's call): the tall hero read as a void
          between the tagline and the content. Wordmark + one sentence,
          modest padding, and the popular row starts within the first
          viewport. */}
      <div className="-mx-4 hero-wash sm:-mx-8 lg:-mx-16 xl:-mx-28">
        <section className="flex flex-col gap-4 px-4 py-8 sm:px-8 md:py-10 lg:px-16 xl:px-28">
          {/*
           * Revalia (see theme.css) — display face, for the wordmark only.
           * font-normal: the self-hosted file ships just the 400 weight, so
           * asking for bold would make the browser synthesize a fake one.
           * Capped at text-7xl — the previous text-9xl hero was, in the
           * owner's words, "overtobig".
           */}
          <h1 className="font-wordmark text-4xl font-normal tracking-wide md:text-6xl lg:text-7xl">
            {t("brand.wordmark")}
          </h1>
          <p className="max-w-content text-lg text-muted md:text-xl">{t("landing.tagline")}</p>
        </section>
      </div>

      <section className="flex flex-col gap-6 rounded-card bg-surface p-6 shadow-card">
        <div data-testid="landing-exercise-count">
          {count.isPending && <p className="text-muted">{t("landing.stat.loading")}</p>}
          {count.isError && <p className="text-muted">{t("landing.stat.error")}</p>}
          {count.data && (
            <p className="text-3xl font-bold tabular-nums">
              {count.data.total.toLocaleString(lang)}{" "}
              <span className="text-lg font-normal text-muted">
                {plural(count.data.total, exerciseNounForms[lang])}{" "}
                {t("landing.stat.rest")}
              </span>
            </p>
          )}
        </div>
        <h2 className="text-xl font-bold tracking-tight">
          {t("landing.popular.heading")}
        </h2>
        {/*
         * The grid renders immediately, holding its final footprint with
         * card-shaped placeholders until the fetches land — the section
         * appearing late used to shove "From the blog" down the page and
         * was the landing's whole CLS score (0.454, measured).
         */}
        <ul className="grid grid-exercises gap-3" data-testid="popular-exercises">
          {popularItems.length > 0
            ? popularItems.map((exercise) => (
                <li key={exercise.id}>
                  <ExerciseCard exercise={exercise} label={term} />
                </li>
              ))
            : POPULAR_EXERCISE_IDS.map((id) => (
                <li key={id} aria-hidden="true">
                  <div className="flex min-h-row-min flex-col items-center gap-2 rounded-card bg-surface p-2 shadow-card">
                    <div className="size-media rounded-row bg-canvas" />
                    <div className="h-4 w-full rounded-full bg-canvas" />
                    <div className="h-3 w-full rounded-full bg-canvas" />
                  </div>
                </li>
              ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight">{t("landing.blog.heading")}</h2>
          <Link to="/blog" className="link-inline text-sm" data-testid="landing-blog-all">
            {t("landing.blog.all")}
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {/* The three latest — the blog page itself carries the full list. */}
          {[...BLOG_POSTS]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 3)
            .map((post) => (
            <li key={post.slug}>
              <Link
                to="/blog/$slug"
                params={{ slug: post.slug }}
                data-testid="landing-blog-card"
                className="group flex h-full flex-col gap-2 rounded-card bg-surface p-6 shadow-card transition-shadow duration-200 ease-out hover:shadow-card-hover"
              >
                <h3 className="font-semibold text-ink decoration-accent decoration-2 underline-offset-4 group-hover:underline">
                  {post.title[lang]}
                </h3>
                <p className="text-sm text-muted">{post.excerpt[lang]}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
}
