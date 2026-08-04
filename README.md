# Подход

A strength-training app built around programs rather than sessions: you define
exercises and a progression rule, and the app computes each workout's target
weight and reps from your own history, then walks you through it set by set.

*Подход* is the Russian word for a set — and for "an approach."

Russian and English throughout.

---

## Status

In development. Design is settled and documented in
[`docs/design.md`](docs/design.md); implementation is phased, starting with the
data pipeline and exercise library.

## Stack

| Layer | |
|---|---|
| Client | Vite 7 · React 19 · TanStack Router · TanStack Query |
| Styling | Tailwind CSS 4 · shadcn/ui (Radix primitives) |
| Motion | GSAP 3 · Flip · DrawSVG |
| API | Hono on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) · Drizzle ORM |
| Auth | Better Auth |

A single Worker serves both the API and the client's static assets, so `/api/*`
is same-origin and authentication uses ordinary `HttpOnly` cookies.

The progression engine lives in `packages/core` as pure functions — no database,
no clock, no network — which is what makes it exhaustively testable.

## Exercise data

Built on [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset):
1,324 exercises with body part, equipment, target muscle and step-by-step
instructions.

Only the instructions are multilingual in the source — exercise names and the
whole taxonomy are English-only — so Russian support is generated at build time
into committed, reviewable artifacts rather than translated at runtime.

**Media attribution.** The exercise images and animations are
**© [Gym visual](https://gymvisual.com/)** and are not covered by this
repository's licence. They are used at 180×180 with attribution retained, per the
source dataset's [NOTICE](https://github.com/hasaneyldrm/exercises-dataset/blob/main/NOTICE.md).
Anyone reusing this project needs to review Gym visual's terms and obtain their
own licence where required. The dataset's non-media content is MIT.

## Why there is no watch integration

Deliberate, not missing. Garmin does not expose the capability required to write
set-level data into FIT files, so no third-party app can push completed strength
sessions into Garmin Connect — Hevy was approved for integration and still could
not do this. Apple HealthKit has no web API at all, and no amount of PWA work
changes that. Commercial aggregators start around $399/month. Reading activity
data *from* Garmin is possible but requires application approval and, for some
metrics, a licence fee.
