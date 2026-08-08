# Подход

A strength-training app built around programs rather than sessions: you define
exercises and a progression rule, and the app computes each workout's target
weight and reps from your own history, then walks you through it set by set.

*Подход* is the Russian word for a set — and for "an approach."

Russian and English throughout.

---

## Status

Live at **[podhod-workout.cc](https://podhod-workout.cc)**.

In development, phased, each phase ending deployable. Shipped so far: the
bilingual exercise library, accounts, the progression engine, and the API for
building training programs. Currently in progress: the screens for building
them. Design and rationale are in [`docs/design.md`](docs/design.md); each
phase has its own plan under [`docs/plans/`](docs/plans/).

| | |
|---|---|
| Exercise library — 1,324 exercises, RU/EN search and filters | shipped |
| Accounts — email/password and Google, sessions in D1 | shipped |
| Progression engine — four schemes, pure functions | shipped |
| Programs API — days, exercises, schemes, reordering | shipped |
| Programs UI — build a program in the browser | in progress |
| Session player — log sets, rest timer, retry outbox | next |
| History and progress — records, tonnage, estimated 1RM | planned |

## Stack

| Layer | |
|---|---|
| Client | Vite 7 · React 19 · TanStack Router · TanStack Query |
| Styling | Tailwind CSS 4 |
| Motion | GSAP 3 · Flip |
| API | Hono on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) · Drizzle ORM |
| Auth | Better Auth · Drizzle adapter · sessions in D1 |

Accounts are email/password and Google, with sessions as ordinary `HttpOnly`
cookies and a `user_settings` row created for every account on signup. There is
no email verification: Cloudflare Email Sending needs the Workers Paid plan, so
`emailVerified` stays false and Google accounts are linked manually from
`/settings` rather than automatically at sign-in — automatic linking on an
unverified email is account takeover.

**The library stays public.** Browsing and searching have never required an
account. Everything under `/programs` requires one, checked both in the route's
`beforeLoad` and again on every API request; the client-side check is a
convenience, and the server one is the gate.

A single Worker serves both the API and the client's static assets, so `/api/*`
is same-origin — the property that lets Better Auth use ordinary `HttpOnly`
cookies instead of a token exchange.

## Programs

A program is a set of training days, each an ordered list of exercises with a
progression scheme. At most one program is active at a time, enforced by a
partial unique index rather than by application code — two concurrent
activations both pass an "is anything else active?" check and both write, so
only the database can refuse the second.

Editing a program never rewrites history. When the session player lands, a
workout will snapshot its plan into `workout_entries.planned` at the moment it
starts; if history pointed at live program rows instead, last March's session
would silently rewrite itself every time an increment changed.

Reordering takes the complete ordered list rather than a from/to pair. That
makes the write idempotent, and the server checks the submitted ids are exactly
the parent's children before touching a row — D1 has no interactive transaction
to roll back inside, so a partial reorder would leave two rows sharing a
position permanently.

## The progression engine

`packages/core` computes what to lift next. Given a scheme and your own history
of an exercise, `nextTarget()` returns the sets, reps and weight for the next
session — plus *why* it changed, as `progressed`, `held` or `deloaded`, so the
UI can explain a deload rather than silently dropping your weight.

Four schemes: fixed, linear with deloads on a failure streak, double progression,
and RPE-based autoregulation. Every computed weight is rounded **down** to the
configured plate increment, because 82.4 kg is not a thing anyone can load, and
rounding up would partly undo a deload that a failure streak just earned.

With no history the engine returns `needsBaseline` instead of guessing — a
distinct shape rather than a nullable weight, because asking for a starting
weight is a different screen, not a missing field. The exception is the fixed
scheme, whose weight is configured rather than derived, so it has nothing to
establish.

It is deliberately pure: no clock, no database, no network, no randomness. The
ordering of the history array is the only temporal information it receives.
That makes every rule testable with a literal input and a literal expectation,
with no mocks anywhere, and a test enforces the purity by reading the source —
so a `Date.now()` added down an untested branch fails the build.

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

Auth needs a signing secret that is never committed. Generate one and put it in
`apps/api/.dev.vars` (git-ignored):

```bash
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> apps/api/.dev.vars
```

Google sign-in needs a Google Cloud OAuth client (the owner's, not one you
generate) with `http://localhost:8787/api/auth/callback/google` and
`https://podhod-workout.cc/api/auth/callback/google` as its only authorised
redirect URIs. Add its id and secret to the same file:

```bash
echo "GOOGLE_CLIENT_ID=..." >> apps/api/.dev.vars
echo "GOOGLE_CLIENT_SECRET=..." >> apps/api/.dev.vars
```

## Running it

```bash
pnpm dev
```

One command for both halves: `pnpm -r --parallel run dev` starts the Worker on
`:8787` and Vite on `:5173`, prefixing each line of output with the package it
came from. Open **http://localhost:5173** — Vite proxies `/api` to the Worker,
so the client is same-origin in development exactly as it is in production, and
no client code branches on environment. Running the two separately still works
if you want their logs in separate terminals:

```bash
pnpm --filter @podhod/api run dev    # Worker + local D1
pnpm --filter @podhod/web run dev    # Vite
```

Vite pre-bundles dependencies when it starts, so after any change to a
dependency — a version bump, a new package — restart it rather than relying on
hot reload.

Then run the workspace tests:

```bash
pnpm test        # unit tests, every package
pnpm typecheck
pnpm --filter @podhod/web run e2e    # Playwright, against a real browser
```

Note the `run` in the filtered commands. `pnpm --filter <pkg> <name>` silently
does nothing when `<name>` collides with one of pnpm's own subcommands, and
exits 0 while doing it.

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
