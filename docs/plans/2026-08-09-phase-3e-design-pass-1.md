# Подход Phase 3e — Design Pass, Part 1

**Goal:** The owner opened the design pass with eight requests: a real header (black bar, aligned padding, bold links, metacritic-style user dropdown with Google avatar and a language *toggle*), a calmer canvas tint, a fixed and smaller hero with new copy, search across saved + ready-made workouts, a blog section with three filler articles, a "most popular" card row on the landing, and an "add to program" flow from the exercise detail page.

**Owner decisions (2026-08-09):** header is **black** (#171717) — white wordmark and bold white links with a lime hover underline (lime on black measures ~16:1); lime stays the accent everywhere else. Canvas moves off the warm beige to a **cool light gray `#F4F5F6`** (my pick, one token — trivially tweakable after she sees real screens). Landing tagline becomes "Your personal workout program and tracker."; the Browse-the-library CTA goes (the nav already does that job).

**Constraints carried over:** no new dependencies; lime is never *text* on light surfaces (1.14–1.21:1 measured — the header being black is what lets nav hover use lime); `@theme`-in-media-query and `@layer base` traps per theme.css comments; grep built CSS for new utilities; all strings bilingual.

**Progress (2026-08-09):** All eight tasks done and committed. 298 unit tests
+ 39 e2e green; verified on real screens at 1440 and 320 (header wraps to two
clean rows on narrow viewports; no horizontal overflow). The theme guard test
now pins the new `#f4f5f6` canvas.

## Tasks

1. **Tokens + header shell.** `--color-canvas: #F4F5F6` (light only). New tokens `--color-header: #171717`, `--color-header-ink: #ffffff` (same in both themes — the bar is black by identity, not by theme). Root layout: the header becomes a full-bleed black band; inside it the same `max-w-page px-4` container `<main>` uses, so header content and page content share edges (the "messy, narrower than the header" complaint). Wordmark white; no border-b — the band is its own edge. Commit: "Give the app a black header aligned with its content".

2. **Nav links + user dropdown.** Library / Programs / Blog as bold links (`font-semibold`, header-ink, hover: lime underline `decoration-2 underline-offset-4`), grouped to the right next to the avatar. `UserMenu.tsx`: avatar button (Google `session.user.image`, else the account's first letter, else a neutral circle), opening a white panel — greeting, **language toggle** (segmented EN | RU, `aria-pressed`, testid `lang-toggle` preserved), Sign out; signed out the panel offers Sign in + the toggle, and a plain Sign in link stays in the bar (`sign-in-link`). Outside-click and Escape close it. e2e helpers updated: identity/sign-out/lang-toggle now live behind `user-menu`. Commit: "Fold identity and language into a user menu".

3. **Hero + landing copy.** The mess at the top (line → canvas gap → gradient) dies with the border and the gap: the wash block starts flush under the black band. Wordmark down to `text-4xl md:text-6xl lg:text-7xl`. New tagline strings; CTA removed. Commit: "Calm the hero down".

4. **Programs search + one-click create.** The name input becomes a search field filtering *both* the user's programs and the template gallery by title (client-side, current language). Create becomes an accent button — a new program named «Новая программа» / "New program" opens its editor immediately; the editor's title gains click-to-rename (inline input, PATCH name). Commit: "Search every workout; create with one click".

5. **Blog.** `src/data/blogPosts.ts`: three bilingual filler articles (real training topics, honest filler prose). Routes `/blog` (cards) and `/blog/$slug` (prose at `max-w-content`). Blog joins the nav (public). Landing gets a three-card blog section. Commit: "Add a blog with three starter articles".

6. **Most popular.** The landing's random sample becomes a curated "Most popular" row — bench press `0025`, squat `0043`, deadlift `0032`, lat pulldown `0198`, overhead press `0091`, biceps curl `0294`, leg press `0739`, RDL `0085` — fetched by id, rendered with the existing `ExerciseCard`; ids pinned by a dataset test. The 1,324 counter line stays. Commit: "Show the most popular exercises on the landing".

7. **Add to program from the detail page.** An accent "Add to program" button on `/library/$id`. Signed out → sign-in with redirect back. Signed in → native dialog: the user's live programs as rows (tap → added with the default 4×10 scheme → confirmation with an "Open" link), plus "New program" (creates, adds, confirms). Commit: "Add an exercise to a program from its page".

8. **E2e.** auth/locale specs updated for the menu; landing spec for the removed CTA and popular cards; new coverage: programs search filters both lists, create-opens-editor-with-rename, blog renders, add-to-program round trip. Commit: "Cover the redesigned shell end to end".

Screenshots at 320/768/1440 after tasks 3 and 8 (the repo's own rule: verify visuals at the extremes before claiming they look good).
