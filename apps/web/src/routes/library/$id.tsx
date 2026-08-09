import { useGSAP } from "@gsap/react";
import { ATTRIBUTION, mediaUrl } from "@podhod/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { useRef } from "react";
import { AddToProgram } from "../../components/AddToProgram.js";
import { useI18n } from "../../i18n/useI18n.js";
import { fetchExercise } from "../../lib/api.js";
import { takeThumbState } from "../../lib/flipStore.js";

gsap.registerPlugin(Flip, useGSAP);

export const Route = createFileRoute("/library/$id")({ component: Detail });

function Detail() {
  const { id } = Route.useParams();
  const { lang, term, t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLImageElement>(null);

  const {
    data,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["exercise", id, lang],
    queryFn: () => fetchExercise(id, lang),
  });

  useGSAP(
    () => {
      if (!data) return;
      const state = takeThumbState();
      // A ref, not a querySelector on a test attribute — removing
      // data-testid="exercise-gif" for test hygiene would otherwise
      // silently kill this animation.
      const media = mediaRef.current;
      if (!media) return;

      gsap.matchMedia().add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduced: "(prefers-reduced-motion: reduce)",
        },
        (ctx) => {
          // State is conveyed by layout and colour; motion is only emphasis.
          if (ctx.conditions?.reduced) return;
          if (state) {
            Flip.from(state, {
              targets: media,
              duration: 0.45,
              ease: "power2.inOut",
              absolute: true,
            });
          } else {
            gsap.from(media, { opacity: 0, y: 12, duration: 0.35 });
          }
        },
      );
    },
    { scope: root, dependencies: [data] },
  );

  // No dedicated back button: the header's Library link is always one glance
  // away, and the browser's own Back covers the literal "go back" gesture.

  if (isError) {
    return (
      <div className="flex flex-col gap-4 py-8">
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
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <p className="text-muted">{t("library.loading")}</p>
      </div>
    );
  }

  return (
    <div ref={root} className="flex flex-col gap-6 py-8">
      {/*
       * Two columns from lg up. Both stretch to equal height
       * (lg:items-stretch) so the shorter side's card grows to meet the
       * taller one instead of leaving empty canvas below it. The left
       * column composes media, taxonomy chips and secondary muscles into
       * one card (rather than three loose elements) so it carries as much
       * visual weight as the instructions card opposite it — a lone 180px
       * thumbnail floating in a wide column read as an afterthought. Below
       * lg both sides stack: the media/metadata column first, then
       * instructions, matching reading order.
       */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-12">
        <div className="flex flex-col gap-4 lg:w-2/5 lg:shrink-0">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{data.name}</h1>
          <AddToProgram exerciseId={data.id} />

          <div className="flex flex-1 flex-col gap-6 rounded-card bg-surface p-6 shadow-card lg:p-8">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-chip-border bg-canvas px-3 py-1 text-xs text-muted">
                {term(data.bodyPart)}
              </span>
              <span className="rounded-full border border-chip-border bg-canvas px-3 py-1 text-xs text-muted">
                {term(data.equipment)}
              </span>
              <span className="rounded-full border border-chip-border bg-canvas px-3 py-1 text-xs text-muted">
                {term(data.target)}
              </span>
            </div>

            {/*
             * The 180x180 licence cap bounds the <img> itself
             * (.size-media); this surrounding "stage" is free to grow with
             * the column's stretched height, so the media stays licence-size
             * while still filling the card rather than sitting pinned to
             * its top-left corner.
             */}
            <div className="flex flex-1 items-center justify-center rounded-row bg-canvas p-6">
              <img
                ref={mediaRef}
                src={mediaUrl(data.gifPath)}
                alt=""
                width={180}
                height={180}
                data-testid="exercise-gif"
                data-flip-id={data.id}
                className="size-media rounded-row object-contain"
              />
            </div>

            {data.secondaryMuscles.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("detail.secondaryMuscles")}
                </h2>
                <p className="text-sm text-muted">
                  {data.secondaryMuscles.map((muscle) => term(muscle)).join(", ")}
                </p>
              </div>
            )}
          </div>

          <p data-testid="attribution" className="text-xs text-muted">
            {ATTRIBUTION}
          </p>
        </div>

        {/*
         * The card fills the column's full width so it doesn't strand empty
         * space between itself and the left column at wide viewports; only
         * the step list inside is capped at max-w-content, keeping the
         * previous session's readable-measure reasoning for the prose
         * itself without shrinking the card around it.
         */}
        <div className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-card lg:flex-1 lg:p-8">
          <h2 className="text-lg font-bold tracking-tight">{t("detail.instructions")}</h2>
          <ol
            data-testid="exercise-steps"
            className="flex max-w-content list-decimal flex-col gap-2 pl-5"
          >
            {data.steps.map((step, i) => (
              <li key={i} className="text-sm leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
