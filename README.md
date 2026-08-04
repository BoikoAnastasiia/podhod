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
| Styling | Tailwind CSS 4 |
| Motion | GSAP 3 · Flip |
| API | Hono on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) · Drizzle ORM |

Planned for Phase 1b: Better Auth, open signup and route protection — this
phase ships the library public and read-only, so accounts are deliberately
deferred rather than missing.

A single Worker serves both the API and the client's static assets, so `/api/*`
is already same-origin — the property Phase 1b's Better Auth will rely on to use
ordinary `HttpOnly` cookies instead of a token exchange.

The progression engine lives in `packages/core` as pure functions — no database,
no clock, no network — which is what makes it exhaustively testable.

## Setup

```bash
pnpm install
```

The library renders nothing until the local database exists and is seeded from
the committed data artifacts:

```bash
pnpm --filter @podhod/api run db:migrate:local
pnpm --filter @podhod/api run seed:local
```

Then run the workspace tests:

```bash
pnpm test
```

## Exercise data

Built on [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset):
1,324 exercises with body part, equipment, target muscle and step-by-step
instructions.

Only the instructions are multilingual in the source — exercise names and the
whole taxonomy (body part, equipment, target, muscle group) are English-only.
The taxonomy is 85 distinct terms, hand-curated into `data/taxonomy.ru.json`; it
drives every filter chip, and a literal or machine rendering of a term like
"waist" or "leverage machine" would be wrong in gym Russian in a way a lifter
notices daily.

**Exercise names stay in English in both locales — a deliberate call, not a
gap.** 1,324 names is too many to hand-translate the way the 85-term taxonomy
was, and Russian phrasing for a name like "dumbbell biceps curl" — "подъём
гантелей на бицепс" — reorders the words and changes their case in ways a
mechanical, word-by-word pass over the English does not reproduce; the result
reads as broken Russian, not idiomatic Russian. English names are also what
Russian lifters commonly use anyway. Everything else — instructions, taxonomy,
UI strings — ships in Russian. `exercise_translations` already stores a name
per language, so Russian names can be filled in by hand later with no schema
change.

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
