# Подход Phase 1a — Data & Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed, bilingual (RU/EN) exercise encyclopedia — 1,324 exercises, searchable and filterable — on Cloudflare Workers + D1.

**Architecture:** A pnpm monorepo. Build-time scripts turn the upstream 17 MB dataset into committed 2.1 MB seed artifacts; a Drizzle/D1 schema stores them; a Hono API on Workers serves them; a Vite + React 19 SPA renders them from static assets served by the same Worker (same-origin, no CORS).

**Tech Stack:** Vite 7 · React 19 · TanStack Router · TanStack Query · Tailwind CSS 4 · GSAP 3 (+Flip) · Hono · Cloudflare Workers · D1 · Drizzle ORM · Zod · Vitest · `@cloudflare/vitest-pool-workers` · Playwright

**Scope note:** Phase 1 in the design doc also includes Better Auth. That is deliberately **deferred to plan 1b** — the library is public and needs no accounts, and splitting keeps each plan independently shippable and reviewable.

## Global Constraints

- Package versions (verified 2026-08-04): `hono@4.13.0`, `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `tailwindcss@4.3.3`, `@tanstack/react-router@1.170.18`, `gsap@3.15.0`, `@gsap/react@2.1.2`, `@cloudflare/vitest-pool-workers@0.20.1`, `react@19`.
- **No inline styles.** No `style={{...}}` anywhere. Tailwind utilities only.
- **No Tailwind arbitrary values.** No `bg-[#D4F14A]`, no `p-[13px]`. Every utility resolves to a `@theme` token.
- Design tokens, exact values: canvas `#F5F5F3`/`#0E0E0E`, surface `#FFFFFF`/`#1A1A1A`, ink `#111111`/`#F2F2F0`, muted `#8A8A85`, accent `#D4F14A`.
- **Accent is state-only** — completed, PR, progression. Never decoration.
- **Text on accent is always `--color-ink-on-accent` (`#111111`)**, never white.
- All numerals render with `font-variant-numeric: tabular-nums`.
- All GSAP animation goes through `useGSAP()` from `@gsap/react`, inside `gsap.matchMedia()` with a `(prefers-reduced-motion: reduce)` branch that sets end states without animating.
- Media attribution string is the constant `ATTRIBUTION = "© Gym visual — https://gymvisual.com/"`, exported from `packages/core`. It renders on every exercise detail view. Media is served at 180×180 only.
- Weight/measurement values: none in this phase.
- Commit messages: no AI attribution, no `Co-Authored-By` trailer.
- **The project has no AI or LLM dependency** — not at runtime, not at build time, and nothing in any `package.json`. Exercise names ship in English (see the Task 3 CUT record).
- Root `package.json` scripts must invoke workspace scripts as `pnpm --filter <pkg> run <script>`. Without `run`, a script whose name collides with a pnpm builtin (`fetch`, `install`, `link`, `pack`, `publish`, `rebuild`, `remove`, `test`…) silently no-ops: exit 0, no output, no error.
- Node 22+, pnpm 9+.

---

## File Structure

```
podhod/
├── package.json                    workspace root + top-level scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── data/
│   ├── .cache/                     gitignored raw download
│   ├── exercises.seed.json         committed artifact (2.1 MB)
│   ├── taxonomy.ru.json            committed, hand-curated, 85 terms
│   ├── src/
│   │   ├── transform.ts            PURE: raw record → seed record
│   │   ├── fetch.ts                I/O: download → .cache
│   │   │   └── build.ts            I/O: .cache → exercises.seed.json
│   └── test/
│       ├── transform.test.ts
│       └── taxonomy.test.ts
├── packages/
│   ├── core/src/index.ts           ATTRIBUTION, mediaUrl()
│   └── schema/src/exercise.ts      zod schemas shared client↔server
├── apps/
│   ├── api/
│   │   ├── wrangler.jsonc
│   │   ├── drizzle.config.ts
│   │   ├── vitest.config.ts
│   │   ├── migrations/             drizzle-kit output
│   │   ├── scripts/seed.ts
│   │   ├── src/
│   │   │   ├── index.ts            Hono app + asset fallback
│   │   │   ├── db/schema.ts        drizzle tables
│   │   │   └── routes/exercises.ts
│   │   └── test/
│   │       ├── helpers.ts          migration applier
│   │       └── exercises.test.ts
│   └── web/
│       ├── vite.config.ts
│       ├── playwright.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── styles/theme.css    @theme tokens
│           ├── lib/api.ts          typed fetch client
│           ├── i18n/               dict + Intl.PluralRules
│           ├── routes/             TanStack file routes
│           └── components/
└── .github/workflows/ci.yml
```

---

### Task 1: Workspace foundation and the dataset transform

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`
- Create: `data/package.json`, `data/src/transform.ts`, `data/src/fetch.ts`, `data/src/build.ts`
- Test: `data/test/transform.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `transformExercise(raw: RawExercise): SeedExercise` and the type `SeedExercise = { id, name, body_part, equipment, target, muscle_group, secondary_muscles: string[], media_id, image, gif_url, steps_en: string[], steps_ru: string[] }`. Task 5 reads `data/exercises.seed.json`, an array of `SeedExercise`.

- [ ] **Step 1: Create the workspace skeleton**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "data"
```

`package.json`:
```json
{
  "name": "podhod",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "typecheck": "pnpm -r --if-present typecheck",
    "test": "pnpm -r --if-present test",
    "data:fetch": "pnpm --filter @podhod/data run fetch",
    "data:build": "pnpm --filter @podhod/data run build"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true
  }
}
```

`data/package.json`:
```json
{
  "name": "@podhod/data",
  "private": true,
  "type": "module",
  "scripts": {
    "fetch": "tsx src/fetch.ts",
    "build": "tsx src/build.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": { "tsx": "^4.19.0" }
}
```

Run: `pnpm install`

- [ ] **Step 2: Write the failing test**

`data/test/transform.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { transformExercise } from "../src/transform.js";

const RAW = {
  id: "0001",
  name: "3/4 sit-up",
  category: "waist",
  body_part: "waist",
  equipment: "body weight",
  muscle_group: "hip flexors",
  secondary_muscles: ["hip flexors", "lower back"],
  target: "abs",
  image: "images/0001-2gPfomN.jpg",
  gif_url: "videos/0001-2gPfomN.gif",
  media_id: "2gPfomN",
  created_at: "2026-03-18T12:31:32.854798+00:00",
  attribution: "© Gym visual — https://gymvisual.com/",
  instructions: { en: "...", ru: "...", es: "...", fr: "..." },
  instruction_steps: {
    en: ["Lie down on the floor.", "Place your hands behind your head."],
    ru: ["Лягте на спину.", "Положите руки за голову."],
    es: ["..."],
    fr: ["..."],
  },
};

describe("transformExercise", () => {
  it("keeps only en and ru steps", () => {
    const out = transformExercise(RAW as never);
    expect(out.steps_en).toEqual(RAW.instruction_steps.en);
    expect(out.steps_ru).toEqual(RAW.instruction_steps.ru);
    expect(out).not.toHaveProperty("instruction_steps");
    expect(out).not.toHaveProperty("instructions");
  });

  it("drops attribution, created_at and the duplicate category field", () => {
    const out = transformExercise(RAW as never);
    expect(out).not.toHaveProperty("attribution");
    expect(out).not.toHaveProperty("created_at");
    expect(out).not.toHaveProperty("category");
  });

  it("carries identity, taxonomy and media fields through unchanged", () => {
    const out = transformExercise(RAW as never);
    expect(out.id).toBe("0001");
    expect(out.name).toBe("3/4 sit-up");
    expect(out.body_part).toBe("waist");
    expect(out.equipment).toBe("body weight");
    expect(out.target).toBe("abs");
    expect(out.muscle_group).toBe("hip flexors");
    expect(out.secondary_muscles).toEqual(["hip flexors", "lower back"]);
    expect(out.media_id).toBe("2gPfomN");
    expect(out.image).toBe("images/0001-2gPfomN.jpg");
    expect(out.gif_url).toBe("videos/0001-2gPfomN.gif");
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `pnpm --filter @podhod/data test`
Expected: FAIL — `Failed to resolve import "../src/transform.js"`.

- [ ] **Step 4: Implement the transform**

`data/src/transform.ts`:
```ts
export type RawExercise = {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  image: string;
  gif_url: string;
  media_id: string;
  created_at: string;
  attribution: string;
  instructions: Record<string, string>;
  instruction_steps: Record<string, string[]>;
};

export type SeedExercise = {
  id: string;
  name: string;
  body_part: string;
  equipment: string;
  target: string;
  muscle_group: string;
  secondary_muscles: string[];
  media_id: string;
  image: string;
  gif_url: string;
  steps_en: string[];
  steps_ru: string[];
};

/**
 * Upstream ships ten languages and a per-row copy of a constant attribution
 * string. We keep en + ru and drop the rest, which is what takes the dataset
 * from 17 MB to ~2.1 MB.
 */
export function transformExercise(raw: RawExercise): SeedExercise {
  return {
    id: raw.id,
    name: raw.name,
    body_part: raw.body_part,
    equipment: raw.equipment,
    target: raw.target,
    muscle_group: raw.muscle_group,
    secondary_muscles: raw.secondary_muscles,
    media_id: raw.media_id,
    image: raw.image,
    gif_url: raw.gif_url,
    steps_en: raw.instruction_steps.en ?? [],
    steps_ru: raw.instruction_steps.ru ?? [],
  };
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `pnpm --filter @podhod/data test`
Expected: PASS, 3 tests.

- [ ] **Step 6: Write the fetch and build scripts**

`data/src/fetch.ts`:
```ts
import { mkdir, writeFile } from "node:fs/promises";

const SRC =
  "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json";

const res = await fetch(SRC);
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
await mkdir(new URL("../.cache/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../.cache/exercises.json", import.meta.url),
  Buffer.from(await res.arrayBuffer()),
);
console.log("fetched exercises.json");
```

`data/src/build.ts`:
```ts
import { readFile, writeFile } from "node:fs/promises";
import { transformExercise, type RawExercise } from "./transform.js";

const raw: RawExercise[] = JSON.parse(
  await readFile(new URL("../.cache/exercises.json", import.meta.url), "utf8"),
);
const seed = raw.map(transformExercise);
const out = new URL("../exercises.seed.json", import.meta.url);
await writeFile(out, JSON.stringify(seed));
console.log(`wrote ${seed.length} exercises`);
```

- [ ] **Step 7: Generate the seed and verify its shape**

Run: `pnpm data:fetch && pnpm data:build`
Expected: `wrote 1324 exercises`.

Run: `node -e "const d=require('./data/exercises.seed.json');console.log(d.length, JSON.stringify(d[0]).slice(0,120))"`
Expected: starts with `1324` and a record containing `steps_ru`.

Run: `ls -la data/exercises.seed.json`
Expected: roughly 2.1 MB.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add workspace and dataset build pipeline

Strip the upstream dataset from ten languages to English and Russian,
reducing the committed seed artifact from 17 MB to 2.1 MB. The transform
is a pure function so it can be tested without network or filesystem."
```

---

### Task 2: Russian taxonomy dictionary

**Files:**
- Create: `data/taxonomy.ru.json`
- Test: `data/test/taxonomy.test.ts`

**Interfaces:**
- Consumes: `data/exercises.seed.json` from Task 1.
- Produces: `data/taxonomy.ru.json` — a flat `Record<string, string>` mapping every English taxonomy term to Russian. Task 9 imports it for filter chips; Task 11 imports it for detail views.

- [ ] **Step 1: Write the failing coverage test**

`data/test/taxonomy.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import seed from "../exercises.seed.json" with { type: "json" };
import taxonomy from "../taxonomy.ru.json" with { type: "json" };
import type { SeedExercise } from "../src/transform.js";

const terms = new Set<string>();
for (const ex of seed as SeedExercise[]) {
  terms.add(ex.body_part);
  terms.add(ex.equipment);
  terms.add(ex.target);
  terms.add(ex.muscle_group);
  for (const m of ex.secondary_muscles) terms.add(m);
}

describe("taxonomy.ru.json", () => {
  it("covers every taxonomy term present in the seed", () => {
    const dict = taxonomy as Record<string, string>;
    const missing = [...terms].filter((t) => !dict[t]).sort();
    expect(missing).toEqual([]);
  });

  it("has no entries the seed does not use", () => {
    const extra = Object.keys(taxonomy).filter((k) => !terms.has(k)).sort();
    expect(extra).toEqual([]);
  });

  it("has a non-empty Cyrillic translation for every term", () => {
    for (const [en, ru] of Object.entries(taxonomy as Record<string, string>)) {
      expect(ru.length, `empty translation for "${en}"`).toBeGreaterThan(0);
      expect(ru, `"${en}" was not translated`).toMatch(/[Ѐ-ӿ]/);
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter @podhod/data test taxonomy`
Expected: FAIL — cannot resolve `../taxonomy.ru.json`.

- [ ] **Step 3: Print the exact term list to translate**

Run:
```bash
node -e "
const s=require('./data/exercises.seed.json');
const t=new Set();
for(const e of s){t.add(e.body_part);t.add(e.equipment);t.add(e.target);t.add(e.muscle_group);e.secondary_muscles.forEach(m=>t.add(m));}
console.log(JSON.stringify([...t].sort(),null,2));
"
```
Expected: exactly 85 terms.

- [ ] **Step 4: Hand-write the dictionary**

Create `data/taxonomy.ru.json` with one entry per term from Step 3. These are gym terms, not dictionary terms — use the vocabulary a Russian-speaking lifter uses. Starting points for the ones most often mistranslated:

```json
{
  "waist": "пресс и корпус",
  "upper arms": "плечо (бицепс/трицепс)",
  "lower arms": "предплечья",
  "upper legs": "бёдра",
  "lower legs": "голени",
  "back": "спина",
  "chest": "грудь",
  "shoulders": "плечи",
  "neck": "шея",
  "cardio": "кардио",
  "body weight": "собственный вес",
  "leverage machine": "рычажный тренажёр",
  "smith machine": "машина Смита",
  "ez barbell": "EZ-гриф",
  "olympic barbell": "олимпийская штанга",
  "trap bar": "трэп-гриф",
  "stability ball": "фитбол",
  "medicine ball": "медбол",
  "resistance band": "резиновая петля",
  "band": "эспандер",
  "cable": "блок",
  "assisted": "с поддержкой",
  "weighted": "с отягощением",
  "abs": "пресс",
  "hip flexors": "сгибатели бедра",
  "lats": "широчайшие",
  "delts": "дельты",
  "glutes": "ягодичные",
  "quads": "квадрицепсы",
  "hamstrings": "бицепс бедра",
  "calves": "икроножные",
  "traps": "трапеции",
  "pectorals": "грудные",
  "triceps": "трицепс",
  "biceps": "бицепс",
  "forearms": "предплечья",
  "serratus anterior": "передняя зубчатая",
  "levator scapulae": "мышца, поднимающая лопатку",
  "spine": "разгибатели спины",
  "adductors": "приводящие",
  "abductors": "отводящие",
  "upper back": "верх спины"
}
```

Complete the remaining terms the same way. Note `"waist"` and `"upper arms"` are body-part *categories*, not literal anatomy — translate for what the filter chip means to a user, not word-for-word.

- [ ] **Step 5: Run the test and confirm it passes**

Run: `pnpm --filter @podhod/data test taxonomy`
Expected: PASS, 3 tests. The `missing` and `extra` assertions name any term you skipped or invented.

- [ ] **Step 6: Commit**

```bash
git add data/taxonomy.ru.json data/test/taxonomy.test.ts
git commit -m "Add hand-curated Russian taxonomy dictionary

Covers all 85 distinct body-part, equipment, target and muscle terms in the
dataset. These appear in every filter chip, so they are translated by hand
rather than generated — a literal rendering of terms like \"waist\" or
\"leverage machine\" is wrong in gym Russian.

A test asserts the dictionary and the dataset stay in sync in both
directions, so neither can drift silently."
```

---

### Task 3: CUT — exercise names ship in English

**Status: removed from the plan on 2026-08-04, before implementation.**

This task originally generated `data/names.ru.json` by calling the Claude API over
the 1,324 English exercise names. It is cut. The project has **no AI or LLM
dependency of any kind** — not at runtime, not at build time, and nothing in
`package.json`.

**What ships instead:** Russian UI strings, Russian instruction steps (which the
upstream dataset already provides), and Russian taxonomy on every filter chip.
**Exercise names stay in English in both locales.** This is defensible on its own
terms — Russian lifters routinely use English and transliterated names — and it is
not a dead end: `exercise_translations` already stores a name per language, so
Russian names can be filled in by hand later, incrementally, with no migration and
no schema change.

**Why not compose them mechanically:** the 1,324 names use only 537 distinct words,
307 of which recur, so word-substitution looks tempting. It does not work.
"dumbbell biceps curl" is *подъём гантелей на бицепс* — genitive plural, reordered,
with a preposition absent from the English. Word-level substitution yields
*гантель бицепс сгибание*, which is not Russian. Correct composition needs
grammatical templates with case and agreement, which is a larger project than the
translation it would replace.

**Downstream effect:** Task 5 seeds the Russian row with the English name and
builds its search text from the Russian taxonomy instead. No other task changes.

---

### Task 4: D1 schema and migrations

**Files:**
- Create: `apps/api/package.json`, `apps/api/wrangler.jsonc`, `apps/api/drizzle.config.ts`, `apps/api/vitest.config.ts`, `apps/api/src/db/schema.ts`, `apps/api/test/helpers.ts`
- Test: `apps/api/test/schema.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: Drizzle tables `exercises` and `exerciseTranslations`; `applyMigrations(db: D1Database): Promise<void>` from `test/helpers.ts`, used by Tasks 5 and 6.

- [ ] **Step 1: Scaffold the API package**

`apps/api/package.json`:
```json
{
  "name": "@podhod/api",
  "private": true,
  "type": "module",
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply podhod-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply podhod-db --remote",
    "seed": "tsx scripts/seed.ts",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "hono": "^4.13.0", "drizzle-orm": "^0.45.2" },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.20.1",
    "@cloudflare/workers-types": "^4.20260801.0",
    "drizzle-kit": "^0.31.10",
    "tsx": "^4.19.0",
    "wrangler": "^4.0.0"
  }
}
```

Run: `pnpm install`
Run: `pnpm --filter @podhod/api exec wrangler d1 create podhod-db`

Copy the returned `database_id` into the next step.

- [ ] **Step 2: Configure Wrangler and Drizzle**

`apps/api/wrangler.jsonc`:
```jsonc
{
  "name": "podhod",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-04",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "../web/dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "podhod-db",
      "database_id": "PASTE_FROM_STEP_1",
      "migrations_dir": "migrations"
    }
  ]
}
```

`apps/api/drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
});
```

- [ ] **Step 3: Write the schema**

`apps/api/src/db/schema.ts`:
```ts
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Language-neutral fields only. `attribution` is deliberately absent — every
 * upstream row carries the identical string, so it lives as a constant in
 * packages/core rather than 1,324 times in the database.
 */
export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    bodyPart: text("body_part").notNull(),
    equipment: text("equipment").notNull(),
    target: text("target").notNull(),
    muscleGroup: text("muscle_group").notNull(),
    secondaryMuscles: text("secondary_muscles", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    mediaId: text("media_id").notNull(),
    imagePath: text("image_path").notNull(),
    gifPath: text("gif_path").notNull(),
  },
  (t) => [
    index("idx_exercises_body_part").on(t.bodyPart),
    index("idx_exercises_equipment").on(t.equipment),
    index("idx_exercises_target").on(t.target),
  ],
);

/**
 * Names live here beside instructions, so adding a third language is a seed
 * change rather than a schema change. `searchText` is a lowercased haystack
 * maintained at seed time — 1,324 rows make LIKE fast enough that FTS5 would
 * be unjustified complexity.
 */
export const exerciseTranslations = sqliteTable(
  "exercise_translations",
  {
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    lang: text("lang").notNull(),
    name: text("name").notNull(),
    steps: text("steps", { mode: "json" }).$type<string[]>().notNull(),
    searchText: text("search_text").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.exerciseId, t.lang] }),
    index("idx_translations_search").on(t.lang, t.searchText),
  ],
);
```

- [ ] **Step 4: Generate the migration**

Run: `pnpm --filter @podhod/api db:generate`
Expected: `apps/api/migrations/0000_*.sql` created.

Run: `pnpm --filter @podhod/api db:migrate:local`
Expected: migration applied to the local D1.

- [ ] **Step 5: Write the test helper and the failing schema test**

`apps/api/vitest.config.ts` — migrations are read from disk here, because the
Worker has no filesystem, and injected as a binding:
```ts
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Despite the vendor docstring, readD1Migrations is on the package root in
// 0.20.1 — the ./config subpath does not exist.
const migrations = await readD1Migrations("./migrations");

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: { poolOptions: { workers: { miniflare: { bindings: { TEST_MIGRATIONS: migrations } } } } },
});
```

`apps/api/test/helpers.ts`:
```ts
import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";

/**
 * Applies every generated migration, in numeric filename order.
 *
 * Splitting and applying are left to readD1Migrations/applyD1Migrations:
 * the former uses wrangler's SQL-aware splitter, the latter runs each
 * statement through `prepare`. Splitting by hand on `--> statement-breakpoint`
 * and flattening newlines for `exec` looks equivalent, but silently truncates
 * any statement containing a `-- comment` — and third-party migrations
 * (Better Auth, Phase 1b) do contain them.
 *
 * `migrations` is overridable only so the fixture suite can drive this with
 * migrations of its own. Callers pass just the database.
 */
export async function applyMigrations(
  db: D1Database,
  migrations: D1Migration[] = env.TEST_MIGRATIONS,
): Promise<void> {
  if (migrations.length === 0) {
    throw new Error(
      "applyMigrations was given no migrations. If apps/api/migrations is empty, " +
        "run `pnpm --filter @podhod/api run db:generate` first.",
    );
  }
  await applyD1Migrations(db, migrations);
}
```

`apps/api/test/schema.test.ts`:
```ts
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./helpers.js";

beforeAll(async () => {
  await applyMigrations(env.DB);
});

describe("schema", () => {
  it("creates both tables", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all<{ name: string }>();
    const names = results.map((r) => r.name);
    expect(names).toContain("exercises");
    expect(names).toContain("exercise_translations");
  });

  it("enforces the composite primary key on translations", async () => {
    await env.DB.prepare(
      "INSERT INTO exercises (id, body_part, equipment, target, muscle_group, secondary_muscles, media_id, image_path, gif_path) VALUES ('0001','waist','body weight','abs','hip flexors','[]','x','i.jpg','g.gif')",
    ).run();
    const insert =
      "INSERT INTO exercise_translations (exercise_id, lang, name, steps, search_text) VALUES ('0001','en','sit-up','[]','sit-up')";
    await env.DB.prepare(insert).run();
    await expect(env.DB.prepare(insert).run()).rejects.toThrow();
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @podhod/api test`
Expected: PASS, 2 tests. If the migration filename differs, fix the import in `helpers.ts` — the error message names the missing file.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add D1 schema and migrations for the exercise library

Names and instructions live together in exercise_translations keyed by
(exercise_id, lang), so adding a third language later is a seed change
rather than a schema change.

search_text is a lowercased haystack maintained at seed time. With 1,324
rows a LIKE scan is sub-millisecond, so FTS5 would be complexity without
a matching benefit.

Tests run against a real Worker and a real D1 instance, with migrations
applied per suite from the generated SQL."
```

---

### Task 5: Seed the database

**Files:**
- Create: `apps/api/scripts/seed.ts`
- Test: `apps/api/test/seed.test.ts`

**Interfaces:**
- Consumes: `data/exercises.seed.json` (Task 1), `data/taxonomy.ru.json` (Task 2), the schema (Task 4), `applyMigrations` (Task 4).
- Produces: `buildRows(seed, taxonomyRu)` returning `{ exercises, translations }` — pure, so it is tested without a database.

**Changed by the Task 3 cut:** there is no `names.ru.json`. The Russian translation row carries the **English name** and builds its search text from the **Russian taxonomy**, so a Russian speaker can find an exercise by typing "грудь" or "штанга" even though the name itself is English.

- [ ] **Step 1: Write the failing test**

`apps/api/test/seed.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildRows } from "../scripts/seed.js";

const SEED = [
  {
    id: "0001",
    name: "3/4 sit-up",
    body_part: "waist",
    equipment: "body weight",
    target: "abs",
    muscle_group: "hip flexors",
    secondary_muscles: ["lower back"],
    media_id: "2gPfomN",
    image: "images/0001-2gPfomN.jpg",
    gif_url: "videos/0001-2gPfomN.gif",
    steps_en: ["Lie down."],
    steps_ru: ["Лягте на спину."],
  },
];

const TAXONOMY = { abs: "пресс", "body weight": "собственный вес" };

describe("buildRows", () => {
  it("produces one exercise row per input", () => {
    const { exercises } = buildRows(SEED, TAXONOMY);
    expect(exercises).toHaveLength(1);
    expect(exercises[0]!.id).toBe("0001");
    expect(exercises[0]!.imagePath).toBe("images/0001-2gPfomN.jpg");
  });

  it("produces an en and a ru translation row per input", () => {
    const { translations } = buildRows(SEED, TAXONOMY);
    expect(translations).toHaveLength(2);
    expect(translations.find((t) => t.lang === "en")!.steps).toEqual(["Lie down."]);
    expect(translations.find((t) => t.lang === "ru")!.steps).toEqual([
      "Лягте на спину.",
    ]);
  });

  it("carries the English name into both locales", () => {
    const { translations } = buildRows(SEED, TAXONOMY);
    expect(translations.find((t) => t.lang === "en")!.name).toBe("3/4 sit-up");
    expect(translations.find((t) => t.lang === "ru")!.name).toBe("3/4 sit-up");
  });

  it("builds English search text from name, target and equipment", () => {
    const { translations } = buildRows(SEED, TAXONOMY);
    expect(translations.find((t) => t.lang === "en")!.searchText).toBe(
      "3/4 sit-up abs body weight",
    );
  });

  it("builds Russian search text from the translated taxonomy", () => {
    const { translations } = buildRows(SEED, TAXONOMY);
    // A Russian speaker can find this by typing "пресс" even though the
    // exercise name itself is English.
    expect(translations.find((t) => t.lang === "ru")!.searchText).toBe(
      "3/4 sit-up пресс собственный вес",
    );
  });

  it("falls back to the English term when the taxonomy lacks an entry", () => {
    const { translations } = buildRows(SEED, {});
    expect(translations.find((t) => t.lang === "ru")!.searchText).toBe(
      "3/4 sit-up abs body weight",
    );
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter @podhod/api test seed`
Expected: FAIL — cannot resolve `../scripts/seed.js`.

- [ ] **Step 3: Implement the seed script**

`apps/api/scripts/seed.ts`:
```ts
import type { SeedExercise } from "../../../data/src/transform.js";

export type ExerciseRow = {
  id: string;
  bodyPart: string;
  equipment: string;
  target: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  mediaId: string;
  imagePath: string;
  gifPath: string;
};

export type TranslationRow = {
  exerciseId: string;
  lang: "en" | "ru";
  name: string;
  steps: string[];
  searchText: string;
};

const searchText = (name: string, target: string, equipment: string) =>
  `${name} ${target} ${equipment}`.toLowerCase();

export function buildRows(
  seed: SeedExercise[],
  taxonomyRu: Record<string, string>,
): { exercises: ExerciseRow[]; translations: TranslationRow[] } {
  const exercises: ExerciseRow[] = [];
  const translations: TranslationRow[] = [];
  const ru = (term: string) => taxonomyRu[term] ?? term;

  for (const e of seed) {
    exercises.push({
      id: e.id,
      bodyPart: e.body_part,
      equipment: e.equipment,
      target: e.target,
      muscleGroup: e.muscle_group,
      secondaryMuscles: e.secondary_muscles,
      mediaId: e.media_id,
      imagePath: e.image,
      gifPath: e.gif_url,
    });

    translations.push({
      exerciseId: e.id,
      lang: "en",
      name: e.name,
      steps: e.steps_en,
      searchText: searchText(e.name, e.target, e.equipment),
    });
    // The name stays English in both locales — see the Task 3 CUT record.
    // Russian search still works because the haystack carries translated
    // taxonomy terms alongside the English name.
    translations.push({
      exerciseId: e.id,
      lang: "ru",
      name: e.name,
      steps: e.steps_ru,
      searchText: searchText(e.name, ru(e.target), ru(e.equipment)),
    });
  }

  return { exercises, translations };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter @podhod/api test seed`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the SQL emitter**

Append to `apps/api/scripts/seed.ts`:
```ts
/** Emits a .sql file so seeding uses `wrangler d1 execute` on both local and remote. */
export function toSql(rows: ReturnType<typeof buildRows>): string {
  const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
  const lines = ["DELETE FROM exercise_translations;", "DELETE FROM exercises;"];

  // Column lists are explicit on purpose. A positional INSERT would silently
  // bind the wrong values if a future migration reorders or inserts a column,
  // and SQLite would accept it as long as the arity matched.
  for (const e of rows.exercises) {
    lines.push(
      "INSERT INTO exercises (id, body_part, equipment, target, muscle_group, " +
        "secondary_muscles, media_id, image_path, gif_path) VALUES (" +
        `${q(e.id)},${q(e.bodyPart)},${q(e.equipment)},${q(e.target)},` +
        `${q(e.muscleGroup)},${q(JSON.stringify(e.secondaryMuscles))},` +
        `${q(e.mediaId)},${q(e.imagePath)},${q(e.gifPath)});`,
    );
  }
  for (const t of rows.translations) {
    lines.push(
      "INSERT INTO exercise_translations (exercise_id, lang, name, steps, " +
        `search_text) VALUES (${q(t.exerciseId)},${q(t.lang)},${q(t.name)},` +
        `${q(JSON.stringify(t.steps))},${q(t.searchText)});`,
    );
  }
  return lines.join("\n");
}
```

Create `apps/api/scripts/emit-seed.ts`:
```ts
import { readFile, writeFile } from "node:fs/promises";
import { buildRows, toSql } from "./seed.js";

const read = async (p: string) =>
  JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));

const sql = toSql(
  buildRows(
    await read("../../../data/exercises.seed.json"),
    await read("../../../data/taxonomy.ru.json"),
  ),
);
await writeFile(new URL("../seed.sql", import.meta.url), sql);
console.log("wrote seed.sql");
```

Add to `apps/api/package.json` scripts:
```json
"seed:emit": "tsx scripts/emit-seed.ts",
"seed:local": "pnpm seed:emit && wrangler d1 execute podhod-db --local --file=seed.sql",
"seed:remote": "pnpm seed:emit && wrangler d1 execute podhod-db --remote --file=seed.sql"
```

Add `apps/api/seed.sql` to `.gitignore` — it is regenerated from committed inputs.

- [ ] **Step 6: Seed locally and verify**

Run: `pnpm --filter @podhod/api seed:local`
Run: `pnpm --filter @podhod/api exec wrangler d1 execute podhod-db --local --command "SELECT COUNT(*) c FROM exercises"`
Expected: `c: 1324`.

Run: `pnpm --filter @podhod/api exec wrangler d1 execute podhod-db --local --command "SELECT name FROM exercise_translations WHERE exercise_id='0025' AND lang='ru'"`
Expected: the **English** name (`barbell bench press`) — names are not translated.

Then confirm Russian search actually works:

Run: `pnpm --filter @podhod/api exec wrangler d1 execute podhod-db --local --command "SELECT search_text FROM exercise_translations WHERE exercise_id='0025' AND lang='ru'"`
Expected: the English name followed by Cyrillic taxonomy terms, e.g. `barbell bench press грудные штанга`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add database seeding from the committed data artifacts

buildRows is pure and tested independently of the database; the emitted
SQL file is applied through wrangler so local and remote seeding use the
same path.

Exercise names ship in English in both locales; the Russian row carries
translated taxonomy in its search text, so a Russian speaker can find an
exercise by muscle or equipment without the name being translated."
```

---

### Task 6: Exercise API

**Files:**
- Create: `packages/schema/package.json`, `packages/schema/src/exercise.ts`, `packages/core/package.json`, `packages/core/src/index.ts`, `apps/api/src/routes/exercises.ts`, `apps/api/src/index.ts`
- Test: `apps/api/test/exercises.test.ts`

**Interfaces:**
- Consumes: schema (Task 4), seeded data (Task 5).
- Produces: `GET /api/exercises?lang&q&bodyPart&equipment&target&limit&cursor` → `{ items: ExerciseListItem[], nextCursor: string | null }`, and `GET /api/exercises/:id?lang` → `ExerciseDetail`. Zod types exported from `@podhod/schema`. Task 9 and Task 10 consume both.

- [ ] **Step 1: Define the shared schemas**

`packages/schema/package.json`:
```json
{
  "name": "@podhod/schema",
  "private": true,
  "type": "module",
  "main": "src/exercise.ts",
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "zod": "^3.24.0" }
}
```

`packages/schema/src/exercise.ts`:
```ts
import { z } from "zod";

export const langSchema = z.enum(["en", "ru"]);
export type Lang = z.infer<typeof langSchema>;

export const listQuerySchema = z.object({
  lang: langSchema.default("en"),
  q: z.string().trim().max(100).optional(),
  bodyPart: z.string().max(40).optional(),
  equipment: z.string().max(40).optional(),
  target: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(30),
  cursor: z.string().max(8).optional(),
});
export type ListQuery = z.input<typeof listQuerySchema>;

export const listItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  bodyPart: z.string(),
  equipment: z.string(),
  target: z.string(),
  imagePath: z.string(),
});
export type ExerciseListItem = z.infer<typeof listItemSchema>;

export const listResponseSchema = z.object({
  items: z.array(listItemSchema),
  nextCursor: z.string().nullable(),
});
export type ListResponse = z.infer<typeof listResponseSchema>;

export const detailSchema = listItemSchema.extend({
  muscleGroup: z.string(),
  secondaryMuscles: z.array(z.string()),
  gifPath: z.string(),
  steps: z.array(z.string()),
});
export type ExerciseDetail = z.infer<typeof detailSchema>;
```

`packages/core/package.json`:
```json
{
  "name": "@podhod/core",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit" }
}
```

`packages/core/src/index.ts`:
```ts
/**
 * Media is © Gym visual, redistributed by the upstream dataset under a separate
 * permission that does not extend to us. It must stay at 180×180 and carry this
 * attribution wherever it is displayed.
 */
export const ATTRIBUTION = "© Gym visual — https://gymvisual.com/";

const DEFAULT_MEDIA_BASE =
  "https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main";

/** One env var away from pointing at R2 if the media is ever licensed directly. */
export function mediaUrl(path: string, base = DEFAULT_MEDIA_BASE): string {
  return `${base}/${path}`;
}
```

- [ ] **Step 2: Write the failing API test**

`apps/api/test/exercises.test.ts`:
```ts
import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./helpers.js";

const insert = async (
  id: string,
  bodyPart: string,
  equipment: string,
  target: string,
  en: string,
  ru: string,
) => {
  await env.DB.prepare(
    "INSERT INTO exercises VALUES (?,?,?,?,'grp','[]','m','i.jpg','g.gif')",
  ).bind(id, bodyPart, equipment, target).run();
  await env.DB.prepare(
    "INSERT INTO exercise_translations VALUES (?,'en',?,'[\"a\"]',?)",
  ).bind(id, en, `${en} ${target} ${equipment}`.toLowerCase()).run();
  await env.DB.prepare(
    "INSERT INTO exercise_translations VALUES (?,'ru',?,'[\"б\"]',?)",
  ).bind(id, ru, `${ru} ${target} ${equipment}`.toLowerCase()).run();
};

beforeAll(async () => {
  await applyMigrations(env.DB);
  await insert("0001", "chest", "barbell", "pectorals", "bench press", "жим лёжа");
  await insert("0002", "back", "cable", "lats", "cable row", "тяга блока");
  await insert("0003", "chest", "dumbbell", "pectorals", "dumbbell fly", "разводка");
});

describe("GET /api/exercises", () => {
  it("returns items in English by default", async () => {
    const res = await SELF.fetch("https://x/api/exercises");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(3);
    expect(body.items.map((i) => i.name)).toContain("bench press");
  });

  it("returns Russian names when lang=ru", async () => {
    const res = await SELF.fetch("https://x/api/exercises?lang=ru");
    const body = await res.json();
    expect(body.items.map((i) => i.name)).toContain("жим лёжа");
  });

  it("filters by body part", async () => {
    const res = await SELF.fetch("https://x/api/exercises?bodyPart=chest");
    const body = await res.json();
    expect(body.items).toHaveLength(2);
  });

  it("searches by substring, case-insensitively", async () => {
    const res = await SELF.fetch("https://x/api/exercises?q=BENCH");
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe("0001");
  });

  it("searches Cyrillic when lang=ru", async () => {
    const res = await SELF.fetch("https://x/api/exercises?lang=ru&q=тяга");
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe("0002");
  });

  it("paginates with a cursor", async () => {
    const first = await (await SELF.fetch("https://x/api/exercises?limit=2")).json();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBe("0002");
    const second = await (
      await SELF.fetch("https://x/api/exercises?limit=2&cursor=0002")
    ).json();
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it("rejects an invalid lang with 400", async () => {
    const res = await SELF.fetch("https://x/api/exercises?lang=de");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("bad_request");
  });
});

describe("GET /api/exercises/:id", () => {
  it("returns the detail record with steps", async () => {
    const res = await SELF.fetch("https://x/api/exercises/0001?lang=ru");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("жим лёжа");
    expect(body.steps).toEqual(["б"]);
    expect(body.gifPath).toBe("g.gif");
  });

  it("returns 404 for an unknown id", async () => {
    const res = await SELF.fetch("https://x/api/exercises/9999");
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `pnpm --filter @podhod/api test exercises`
Expected: FAIL — no `src/index.ts` route handlers, or 404 on every request.

- [ ] **Step 4: Implement the routes**

`apps/api/src/routes/exercises.ts`:
```ts
import { detailSchema, listQuerySchema, type Lang } from "@podhod/schema";
import { and, asc, eq, gt, like, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { exercises, exerciseTranslations } from "../db/schema.js";

type Env = { Bindings: { DB: D1Database } };

export const exerciseRoutes = new Hono<Env>()
  .get("/", async (c) => {
    const parsed = listQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json(
        { error: { code: "bad_request", message: parsed.error.message } },
        400,
      );
    }
    const { lang, q, bodyPart, equipment, target, limit, cursor } = parsed.data;
    const db = drizzle(c.env.DB);

    const where: SQL[] = [eq(exerciseTranslations.lang, lang)];
    if (q) where.push(like(exerciseTranslations.searchText, `%${q.toLowerCase()}%`));
    if (bodyPart) where.push(eq(exercises.bodyPart, bodyPart));
    if (equipment) where.push(eq(exercises.equipment, equipment));
    if (target) where.push(eq(exercises.target, target));
    if (cursor) where.push(gt(exercises.id, cursor));

    // Fetch one extra row to decide whether another page exists.
    const rows = await db
      .select({
        id: exercises.id,
        name: exerciseTranslations.name,
        bodyPart: exercises.bodyPart,
        equipment: exercises.equipment,
        target: exercises.target,
        imagePath: exercises.imagePath,
      })
      .from(exercises)
      .innerJoin(
        exerciseTranslations,
        eq(exerciseTranslations.exerciseId, exercises.id),
      )
      .where(and(...where))
      .orderBy(asc(exercises.id))
      .limit(limit + 1);

    const items = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? (items.at(-1)?.id ?? null) : null;
    return c.json({ items, nextCursor });
  })
  .get("/:id", async (c) => {
    const lang = (c.req.query("lang") === "ru" ? "ru" : "en") satisfies Lang;
    const db = drizzle(c.env.DB);

    const [row] = await db
      .select({
        id: exercises.id,
        name: exerciseTranslations.name,
        bodyPart: exercises.bodyPart,
        equipment: exercises.equipment,
        target: exercises.target,
        imagePath: exercises.imagePath,
        muscleGroup: exercises.muscleGroup,
        secondaryMuscles: exercises.secondaryMuscles,
        gifPath: exercises.gifPath,
        steps: exerciseTranslations.steps,
      })
      .from(exercises)
      .innerJoin(
        exerciseTranslations,
        eq(exerciseTranslations.exerciseId, exercises.id),
      )
      .where(
        and(eq(exercises.id, c.req.param("id")), eq(exerciseTranslations.lang, lang)),
      )
      .limit(1);

    if (!row) {
      return c.json(
        { error: { code: "not_found", message: "exercise not found" } },
        404,
      );
    }
    return c.json(detailSchema.parse(row));
  });
```

`apps/api/src/index.ts`:
```ts
import { Hono } from "hono";
import { exerciseRoutes } from "./routes/exercises.js";

type Env = { Bindings: { DB: D1Database; ASSETS: Fetcher } };

const app = new Hono<Env>();

app.route("/api/exercises", exerciseRoutes);

app.notFound((c) =>
  c.json({ error: { code: "not_found", message: "no such route" } }, 404),
);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: { code: "internal", message: "unexpected error" } }, 500);
});

export default app;
```

Add to root `package.json` dependencies wiring so workspace imports resolve:
Run: `pnpm --filter @podhod/api add @podhod/schema@workspace:* @podhod/core@workspace:*`

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @podhod/api test`
Expected: PASS — 9 exercise tests plus the earlier schema and seed tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add exercise list and detail API

Filtering, substring search and keyset pagination over the library, with
language selected per request. Search runs against a precomputed
lowercased column so Cyrillic and Latin queries take the same path.

Pagination is keyset rather than offset: it fetches one row beyond the
page to decide whether a next cursor exists, which stays correct as rows
change and avoids a second count query.

Query parameters are validated with the Zod schemas the client shares,
so a malformed request fails at the boundary with a typed error envelope."
```

---

### Task 7: Web application foundation

**Files:**
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/styles/theme.css`, `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/index.tsx`, `apps/web/src/lib/api.ts`
- Test: `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `@podhod/schema` (Task 6), the running Worker (Task 6).
- Produces: `fetchExercises(params)`, `fetchExercise(id, lang)`; the Tailwind `@theme` token names used by every later task; the TanStack Router file-route convention.

- [ ] **Step 1: Scaffold the web package**

`apps/web/package.json`:
```json
{
  "name": "@podhod/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@gsap/react": "^2.1.2",
    "@podhod/core": "workspace:*",
    "@podhod/schema": "workspace:*",
    "@tanstack/react-query": "^5.60.0",
    "@tanstack/react-router": "^1.170.18",
    "gsap": "^3.15.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@tanstack/router-plugin": "^1.170.18",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.3.3",
    "vite": "^7.0.0"
  }
}
```

Run: `pnpm install`

`apps/web/vite.config.ts`:
```ts
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  server: {
    // Same-origin in production; proxied in dev so client code never
    // branches on environment.
    proxy: { "/api": "http://localhost:8787" },
  },
});
```

- [ ] **Step 2: Define the design tokens**

`apps/web/src/styles/theme.css`:
```css
@import "tailwindcss";

@theme {
  --color-canvas: #f5f5f3;
  --color-surface: #ffffff;
  --color-ink: #111111;
  --color-muted: #8a8a85;
  --color-accent: #d4f14a;
  --color-ink-on-accent: #111111;

  --radius-card: 24px;
  --radius-row: 16px;

  --spacing-row-min: 56px;
  --spacing-tap-min: 44px;
  /* The media licence caps images and GIFs at 180x180; the frame matches. */
  --spacing-media: 180px;
}

/*
 * Dark mode overrides the custom properties at :root — it must NOT nest an
 * @theme block inside the media query. Tailwind 4 hoists a nested @theme out
 * of its at-rule and merges it into :root, so the dark values would win
 * unconditionally and the light theme would never render at all. Utilities
 * resolve var(--color-canvas) at use time, so overriding the variable suffices.
 */
@layer base {
  @media (prefers-color-scheme: dark) {
    :root {
      --color-canvas: #0e0e0e;
      --color-surface: #1a1a1a;
      --color-ink: #f2f2f0;
    }
  }
}

/* Set numerals globally: set rows must not shift as weights change. */
html {
  font-variant-numeric: tabular-nums;
}
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Подход</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Write the failing API-client test**

`apps/web/src/lib/api.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchExercise, fetchExercises } from "./api.js";

afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body });

describe("fetchExercises", () => {
  it("omits empty optional params from the query string", async () => {
    const f = ok({ items: [], nextCursor: null });
    vi.stubGlobal("fetch", f);
    await fetchExercises({ lang: "en", q: "", bodyPart: undefined });
    const url = f.mock.calls[0]![0] as string;
    expect(url).toContain("lang=en");
    expect(url).not.toContain("q=");
    expect(url).not.toContain("bodyPart=");
  });

  it("encodes Cyrillic queries", async () => {
    const f = ok({ items: [], nextCursor: null });
    vi.stubGlobal("fetch", f);
    await fetchExercises({ lang: "ru", q: "жим" });
    expect(f.mock.calls[0]![0]).toContain(encodeURIComponent("жим"));
  });
});

describe("fetchExercise", () => {
  it("throws with the server error code on a failed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: { code: "not_found", message: "nope" } }),
      }),
    );
    await expect(fetchExercise("9999", "en")).rejects.toThrow(/not_found/);
  });
});
```

- [ ] **Step 4: Run the test and confirm it fails**

Run: `pnpm --filter @podhod/web test`
Expected: FAIL — cannot resolve `./api.js`.

- [ ] **Step 5: Implement the API client**

`apps/web/src/lib/api.ts`:
```ts
import {
  detailSchema,
  listResponseSchema,
  type ExerciseDetail,
  type Lang,
  type ListResponse,
} from "@podhod/schema";

async function get<T>(path: string, parse: (v: unknown) => T): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = (await res.json()) as { error?: { code?: string } };
    throw new Error(body.error?.code ?? `http_${res.status}`);
  }
  return parse(await res.json());
}

export type ExerciseFilters = {
  lang: Lang;
  q?: string;
  bodyPart?: string;
  equipment?: string;
  target?: string;
  cursor?: string;
};

export function fetchExercises(f: ExerciseFilters): Promise<ListResponse> {
  const params = new URLSearchParams({ lang: f.lang });
  for (const key of ["q", "bodyPart", "equipment", "target", "cursor"] as const) {
    const value = f[key];
    if (value) params.set(key, value);
  }
  return get(`/api/exercises?${params}`, (v) => listResponseSchema.parse(v));
}

export function fetchExercise(id: string, lang: Lang): Promise<ExerciseDetail> {
  return get(`/api/exercises/${id}?lang=${lang}`, (v) => detailSchema.parse(v));
}
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `pnpm --filter @podhod/web test`
Expected: PASS, 3 tests.

- [ ] **Step 7: Add the router shell**

`apps/web/src/routes/__root.tsx`:
```tsx
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="flex items-center gap-4 px-4 py-4">
        <Link to="/" className="text-xl font-bold tracking-tight">
          Подход
        </Link>
      </header>
      <main className="px-4 pb-16">
        <Outlet />
      </main>
    </div>
  ),
});
```

`apps/web/src/routes/index.tsx`:
```tsx
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <Link
      to="/library"
      className="inline-flex min-h-tap-min items-center rounded-full bg-ink px-6 text-surface"
    >
      Browse the library
    </Link>
  ),
});
```

`apps/web/src/main.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { routeTree } from "./routeTree.gen";
import "./styles/theme.css";

const router = createRouter({ routeTree });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 8: Verify the app boots**

Run in one terminal: `pnpm --filter @podhod/api dev`
Run in another: `pnpm --filter @podhod/web dev`
Open `http://localhost:5173`.
Expected: the "Подход" header and the button, on the off-white canvas.

Run: `pnpm --filter @podhod/web build`
Expected: builds to `apps/web/dist`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add web application foundation

Vite, React 19, TanStack Router with file-based routes, TanStack Query,
and the Tailwind theme tokens.

Design tokens are declared once in @theme; arbitrary Tailwind values are
prohibited so every utility resolves to a token and the palette cannot
drift into one-off hex codes. Tabular numerals are set globally.

The dev server proxies /api to the Worker so client code never branches
on environment — the two are same-origin in production."
```

---

### Task 8: Worker serves the built SPA

**Files:**
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/test/assets.test.ts`

**Interfaces:**
- Consumes: `apps/web/dist` (Task 7), Hono app (Task 6).
- Produces: a single deployable Worker serving `/api/*` and the SPA.

- [ ] **Step 1: Write the failing test**

`apps/api/test/assets.test.ts`:
```ts
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("asset routing", () => {
  it("serves the SPA shell for an app route", async () => {
    const res = await SELF.fetch("https://x/library");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("returns a JSON 404 for an unknown API route, not the SPA shell", async () => {
    const res = await SELF.fetch("https://x/api/nope");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter @podhod/web build && pnpm --filter @podhod/api test assets`
Expected: FAIL on the first test — the Hono `notFound` handler answers `/library` with JSON.

- [ ] **Step 3: Delegate non-API routes to the assets binding**

Replace the `notFound` handler in `apps/api/src/index.ts`:
```ts
/**
 * `run_worker_first: ["/api/*"]` means only API paths reach the Worker before
 * the asset layer, so anything arriving here that is not /api/* is a client
 * route and belongs to the SPA. API misses stay JSON.
 */
app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: { code: "not_found", message: "no such route" } }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter @podhod/api test assets`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Serve the SPA and the API from a single Worker

One deployment serves both, making /api same-origin. This removes CORS
entirely and means authentication can later use ordinary HttpOnly cookies
rather than a token exchange.

API paths that miss still return the JSON error envelope rather than the
SPA shell, so a client bug surfaces as a 404 instead of an HTML parse
error."
```

---

### Task 9: Library list

**Files:**
- Create: `apps/web/src/routes/library/index.tsx`, `apps/web/src/components/ExerciseCard.tsx`, `apps/web/src/components/FilterChips.tsx`, `apps/web/playwright.config.ts`, `apps/web/e2e/library.spec.ts`

**Interfaces:**
- Consumes: `fetchExercises` (Task 7), `mediaUrl` (Task 6), `taxonomy.ru.json` (Task 2).
- Produces: the `.exercise-thumb` class name that Task 10's Flip morph captures.

- [ ] **Step 1: Write the failing end-to-end test**

`apps/web/playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:5173" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
```

`apps/web/e2e/library.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("browses, searches and filters the library", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();

  await page.getByPlaceholder(/search/i).fill("bench press");
  await expect(page.getByTestId("exercise-card")).toHaveCount(1, { timeout: 5000 });
  await expect(page.getByTestId("exercise-card").first()).toContainText(
    /bench press/i,
  );

  await page.getByPlaceholder(/search/i).clear();
  await page.getByRole("button", { name: "chest" }).click();
  const cards = page.getByTestId("exercise-card");
  await expect(cards.first()).toBeVisible();
  await expect(cards.first()).toContainText(/chest/i);
});

test("filter chips meet the minimum tap target height", async ({ page }) => {
  await page.goto("/library");
  const chip = page.getByRole("button", { name: "chest" });
  const box = await chip.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});
```

Run: `pnpm --filter @podhod/web exec playwright install chromium`

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter @podhod/web exec playwright test`
Expected: FAIL — `/library` does not exist.

- [ ] **Step 3: Build the card component**

`apps/web/src/components/ExerciseCard.tsx`:
```tsx
import { mediaUrl } from "@podhod/core";
import type { ExerciseListItem } from "@podhod/schema";
import { Link } from "@tanstack/react-router";

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
      className="flex min-h-row-min flex-col gap-2 rounded-card bg-surface p-3"
    >
      {/* Media is capped at 180x180 by licence; the frame is fixed to match. */}
      <img
        src={mediaUrl(exercise.imagePath)}
        alt=""
        width={180}
        height={180}
        loading="lazy"
        className="exercise-thumb size-full rounded-row bg-canvas object-contain"
        data-exercise-id={exercise.id}
      />
      <span className="text-sm font-semibold leading-tight">{exercise.name}</span>
      <span className="text-xs text-muted">
        {label(exercise.bodyPart)} · {label(exercise.equipment)}
      </span>
    </Link>
  );
}
```

- [ ] **Step 4: Build the filter chips**

`apps/web/src/components/FilterChips.tsx`:
```tsx
export function FilterChips({
  options,
  selected,
  onSelect,
  label,
}: {
  options: string[];
  selected: string | undefined;
  onSelect: (value: string | undefined) => void;
  label: (term: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? undefined : option)}
            /* Accent marks state, never decoration. Ink stays dark on accent. */
            className={
              active
                ? "min-h-tap-min rounded-full bg-accent px-4 text-sm font-medium text-ink-on-accent"
                : "min-h-tap-min rounded-full bg-surface px-4 text-sm text-ink"
            }
          >
            {label(option)}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Build the route**

`apps/web/src/routes/library/index.tsx`:
```tsx
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
```

This imports `useI18n` from Task 11. Create a temporary stand-in now so the task is independently runnable:

`apps/web/src/i18n/useI18n.ts`:
```ts
import type { Lang } from "@podhod/schema";

/**
 * Stand-in. Task 11 replaces this with a context-backed store returning
 * `{ lang, setLang, t, term, plural }`. This returns the subset Task 9 uses,
 * so the call sites written here keep compiling unchanged.
 */
export function useI18n(): { lang: Lang; term: (t: string) => string } {
  return { lang: "en", term: (t) => t };
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm --filter @podhod/api dev` in one terminal.
Run: `pnpm --filter @podhod/web exec playwright test`
Expected: PASS, 2 tests.

- [ ] **Step 7: Verify at layout extremes**

Run: `pnpm --filter @podhod/web dev` and check `/library` at viewport widths 320px, 768px and 1920px.
Expected: no horizontal overflow; cards stay legible; chips wrap rather than scroll off-screen.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add the exercise library list

Search and body-part filtering over the full library, with a responsive
card grid.

The accent colour appears only on an active filter chip — it marks state,
never decoration — and text on accent stays near-black, which white fails
against at this luminance. Chips and the search field meet the 44px
minimum tap target, since this is used at arm's length with sweaty hands.

Thumbnails sit in a fixed 180px frame because the licence caps the media
at that resolution."
```

---

### Task 10: Exercise detail with a Flip morph

**Files:**
- Create: `apps/web/src/routes/library/$id.tsx`, `apps/web/src/lib/flipStore.ts`
- Modify: `apps/web/src/components/ExerciseCard.tsx`
- Test: `apps/web/e2e/detail.spec.ts`

**Interfaces:**
- Consumes: `fetchExercise` (Task 7), `ATTRIBUTION` and `mediaUrl` (Task 6), `.exercise-thumb` (Task 9).
- Produces: `captureThumb(id)` / `takeThumbState()` for the Flip transition.

- [ ] **Step 1: Write the failing test**

`apps/web/e2e/detail.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("opens an exercise detail from the library", async ({ page }) => {
  await page.goto("/library");
  await page.getByTestId("exercise-card").first().click();

  await expect(page.getByTestId("exercise-gif")).toBeVisible();
  await expect(page.getByTestId("exercise-steps").getByRole("listitem").first())
    .toBeVisible();
  await expect(page.getByTestId("attribution")).toContainText("Gym visual");
});

test("the animation frame is 180px, matching the licence cap", async ({ page }) => {
  await page.goto("/library");
  await page.getByTestId("exercise-card").first().click();
  const box = await page.getByTestId("exercise-gif").boundingBox();
  expect(box!.width).toBeLessThanOrEqual(180);
  expect(box!.height).toBeLessThanOrEqual(180);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter @podhod/web exec playwright test detail`
Expected: FAIL — no detail route.

- [ ] **Step 3: Add the Flip state store**

`apps/web/src/lib/flipStore.ts`:
```ts
import { Flip } from "gsap/Flip";

/**
 * Flip animates from a recorded state object rather than a live element, so
 * the outgoing route never has to stay mounted. That is why route transitions
 * here need no presence layer and no delayed unmount.
 */
let pending: Flip.FlipState | null = null;

export function captureThumb(id: string): void {
  const el = document.querySelector(`[data-exercise-id="${id}"]`);
  pending = el ? Flip.getState(el) : null;
}

export function takeThumbState(): Flip.FlipState | null {
  const state = pending;
  pending = null;
  return state;
}
```

Add the capture to `ExerciseCard.tsx` — inside the `<Link>` props:
```tsx
onClick={() => captureThumb(exercise.id)}
```
with `import { captureThumb } from "../lib/flipStore.js";` at the top.

- [ ] **Step 4: Build the detail route**

`apps/web/src/routes/library/$id.tsx`:
```tsx
import { useGSAP } from "@gsap/react";
import { ATTRIBUTION, mediaUrl } from "@podhod/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { useRef } from "react";
import { useI18n } from "../../i18n/useI18n.js";
import { fetchExercise } from "../../lib/api.js";
import { takeThumbState } from "../../lib/flipStore.js";

gsap.registerPlugin(Flip, useGSAP);

export const Route = createFileRoute("/library/$id")({ component: Detail });

function Detail() {
  const { id } = Route.useParams();
  const { lang, term } = useI18n();
  const root = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["exercise", id, lang],
    queryFn: () => fetchExercise(id, lang),
  });

  useGSAP(
    () => {
      if (!data) return;
      const state = takeThumbState();
      const media = root.current?.querySelector("[data-testid='exercise-gif']");
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

  if (!data) return <p className="text-muted">Loading…</p>;

  return (
    <div ref={root} className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
      <p className="text-sm text-muted">
        {term(data.bodyPart)} · {term(data.equipment)} · {term(data.target)}
      </p>

      <div className="w-max rounded-card bg-surface p-3">
        <img
          src={mediaUrl(data.gifPath)}
          alt={data.name}
          width={180}
          height={180}
          data-testid="exercise-gif"
          className="size-media rounded-row bg-canvas object-contain"
        />
      </div>

      <ol
        data-testid="exercise-steps"
        className="flex list-decimal flex-col gap-2 pl-5"
      >
        {data.steps.map((step, i) => (
          <li key={i} className="text-sm leading-relaxed">
            {step}
          </li>
        ))}
      </ol>

      <p data-testid="attribution" className="text-xs text-muted">
        {ATTRIBUTION}
      </p>
    </div>
  );
}
```

`size-media` resolves to the `--spacing-media` token added in Task 7 — the 180px licence cap is expressed as a token rather than an arbitrary value, so the ban stays absolute.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @podhod/web exec playwright test`
Expected: PASS, 4 tests.

- [ ] **Step 6: Verify the morph and reduced motion by eye**

Run the dev servers, click a card, and confirm the thumbnail morphs into the detail frame rather than cross-fading.
Then enable reduced motion (macOS: System Settings → Accessibility → Display → Reduce motion) and confirm the detail view appears instantly and fully legible, with no animation.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add exercise detail with a shared-element transition

The library thumbnail morphs into the detail frame using GSAP Flip. Flip
animates from a recorded state object rather than a live element, so the
outgoing route never has to stay mounted and the router lifecycle is left
alone — no presence wrapper, no delayed unmount.

Flip was chosen over the View Transitions API because view transitions
cannot be interrupted: navigating again mid-flight snaps.

All motion is declared inside gsap.matchMedia with a reduced-motion branch
that holds end states instead of animating to them. State is carried by
layout and colour, so nothing is lost when motion is off.

Media attribution renders on every detail view as the licence requires."
```

---

### Task 11: Language switching

**Files:**
- Create: `apps/web/src/i18n/dict.ts`, `apps/web/src/i18n/plural.ts`, `apps/web/src/i18n/useI18n.ts` (replaces the stand-in)
- Modify: `apps/web/src/routes/__root.tsx`
- Test: `apps/web/src/i18n/plural.test.ts`, `apps/web/e2e/locale.spec.ts`

**Interfaces:**
- Consumes: `taxonomy.ru.json` (Task 2), the `useI18n` shape from Task 9.
- Produces: `useI18n(): { lang, setLang, t, term, plural }`.

- [ ] **Step 1: Write the failing plural test**

Russian has three plural forms, so `Intl.PluralRules` is doing real work here.

`apps/web/src/i18n/plural.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { plural } from "./plural.js";

const SETS = { one: "подход", few: "подхода", many: "подходов" };

describe("plural (ru)", () => {
  it.each([
    [1, "подход"],
    [2, "подхода"],
    [3, "подхода"],
    [4, "подхода"],
    [5, "подходов"],
    [11, "подходов"],
    [21, "подход"],
    [22, "подхода"],
    [25, "подходов"],
    [0, "подходов"],
  ])("%i -> %s", (n, expected) => {
    expect(plural("ru", n, SETS)).toBe(expected);
  });
});

describe("plural (en)", () => {
  it("uses the one/other split", () => {
    const forms = { one: "set", other: "sets" };
    expect(plural("en", 1, forms)).toBe("set");
    expect(plural("en", 2, forms)).toBe("sets");
    expect(plural("en", 0, forms)).toBe("sets");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter @podhod/web test plural`
Expected: FAIL — cannot resolve `./plural.js`.

- [ ] **Step 3: Implement pluralisation**

`apps/web/src/i18n/plural.ts`:
```ts
import type { Lang } from "@podhod/schema";

type Forms = Partial<Record<Intl.LDMLPluralRule, string>>;

const rules: Record<Lang, Intl.PluralRules> = {
  en: new Intl.PluralRules("en"),
  ru: new Intl.PluralRules("ru"),
};

/**
 * Russian selects between three forms (подход / подхода / подходов) on rules
 * that are not derivable from the number alone — 21 takes the same form as 1,
 * 11 does not. Intl.PluralRules is the correct source of truth; a library for
 * ~150 strings would not be.
 */
export function plural(lang: Lang, n: number, forms: Forms): string {
  const category = rules[lang].select(n);
  return forms[category] ?? forms.other ?? "";
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter @podhod/web test plural`
Expected: PASS, 12 cases.

- [ ] **Step 5: Add the dictionary and the hook**

`apps/web/src/i18n/dict.ts`:
```ts
import type { Lang } from "@podhod/schema";

export const dict: Record<Lang, Record<string, string>> = {
  en: {
    "nav.library": "Library",
    "library.search": "Search exercises",
    "library.loading": "Loading…",
    "library.empty": "Nothing matches those filters.",
  },
  ru: {
    "nav.library": "Упражнения",
    "library.search": "Поиск упражнений",
    "library.loading": "Загрузка…",
    "library.empty": "Ничего не найдено.",
  },
};
```

`apps/web/src/i18n/useI18n.ts` (replacing the stand-in):
```ts
import type { Lang } from "@podhod/schema";
import { createContext, useContext } from "react";
import taxonomyRu from "../../../../data/taxonomy.ru.json" with { type: "json" };
import { dict } from "./dict.js";
import { plural } from "./plural.js";

export type I18n = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  /** Translates a taxonomy term (body part, equipment, target, muscle). */
  term: (value: string) => string;
  plural: (n: number, forms: Parameters<typeof plural>[2]) => string;
};

export const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n used outside I18nContext");
  return ctx;
}

export function buildI18n(lang: Lang, setLang: (l: Lang) => void): I18n {
  const taxonomy = taxonomyRu as Record<string, string>;
  return {
    lang,
    setLang,
    t: (key) => dict[lang][key] ?? key,
    term: (value) => (lang === "ru" ? (taxonomy[value] ?? value) : value),
    plural: (n, forms) => plural(lang, n, forms),
  };
}
```

- [ ] **Step 6: Wire the switcher into the shell**

Update `apps/web/src/routes/__root.tsx`:
```tsx
import type { Lang } from "@podhod/schema";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { buildI18n, I18nContext } from "../i18n/useI18n.js";

const STORAGE_KEY = "podhod.lang";

export const Route = createRootRoute({ component: Shell });

function Shell() {
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem(STORAGE_KEY) as Lang | null) ?? "en",
  );

  const change = (next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
    setLang(next);
  };

  return (
    <I18nContext.Provider value={buildI18n(lang, change)}>
      <div className="min-h-dvh bg-canvas text-ink">
        <header className="flex items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight">
            Подход
          </Link>
          <button
            type="button"
            data-testid="lang-toggle"
            onClick={() => change(lang === "en" ? "ru" : "en")}
            className="min-h-tap-min rounded-full bg-surface px-4 text-sm"
          >
            {lang === "en" ? "RU" : "EN"}
          </button>
        </header>
        <main className="px-4 pb-16">
          <Outlet />
        </main>
      </div>
    </I18nContext.Provider>
  );
}
```

- [ ] **Step 7: Write and run the locale end-to-end test**

`apps/web/e2e/locale.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("switches the library to Russian", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();

  await page.getByTestId("lang-toggle").click();

  const first = page.getByTestId("exercise-card").first();
  await expect(first).toContainText(/[Ѐ-ӿ]/);
  await expect(page.getByRole("button", { name: /спина|грудь/ }).first())
    .toBeVisible();
});

test("Russian labels do not overflow a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/library");
  await page.getByTestId("lang-toggle").click();
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
```

Update `library/index.tsx` to use `t` for the placeholder and loading text, and swap `BODY_PARTS` labels through `term`.

Run: `pnpm --filter @podhod/web exec playwright test`
Expected: PASS, 6 tests.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add Russian and English language switching

Exercise names come from the database per request; taxonomy terms are
translated client-side from the curated dictionary.

Russian pluralisation uses Intl.PluralRules rather than an i18n library.
Three forms are required (подход / подхода / подходов) on rules that are
not derivable from the number — 21 takes the same form as 1, 11 does not —
and for roughly 150 strings a library would be weight without benefit.

An end-to-end test checks a 320px viewport in Russian, since Russian runs
about 15% longer and exercise names are the worst case."
```

---

### Task 12: Continuous integration and deployment

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: root `package.json`

**Interfaces:**
- Consumes: every prior task.
- Produces: a deployed Worker at the workers.dev URL.

- [ ] **Step 1: Add the workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }

      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm --filter @podhod/web build

      - run: pnpm --filter @podhod/web exec playwright install --with-deps chromium
      - run: pnpm --filter @podhod/api exec wrangler d1 migrations apply podhod-db --local
      - run: pnpm --filter @podhod/api seed:local

      # Playwright's webServer starts Vite, which proxies /api to :8787.
      # The Worker has to already be listening, so start it here and give it
      # a moment to bind before the browser pass runs.
      - run: pnpm --filter @podhod/api dev &
      - run: npx wait-on http://localhost:8787/api/exercises --timeout 60000

      - run: pnpm --filter @podhod/web exec playwright test
        env:
          CI: "true"

  deploy:
    needs: verify
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @podhod/web build
      - run: pnpm --filter @podhod/api exec wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Two servers are needed for the browser pass: Playwright's `webServer` starts Vite, and the workflow starts the Worker separately because Vite's proxy target must already be listening. `wait-on` blocks until the Worker binds rather than relying on a fixed sleep.

- [ ] **Step 2: Add the repository secrets**

In GitHub → Settings → Secrets → Actions, add `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit, D1: Edit) and `CLOUDFLARE_ACCOUNT_ID`.

- [ ] **Step 3: Deploy remotely for the first time**

Run: `pnpm --filter @podhod/api db:migrate:remote`
Run: `pnpm --filter @podhod/api seed:remote`
Run: `pnpm --filter @podhod/web build && pnpm --filter @podhod/api deploy`

- [ ] **Step 4: Verify the deployment**

Run: `curl -s "https://podhod.<subdomain>.workers.dev/api/exercises?lang=ru&q=жим" | head -c 400`
Expected: JSON with Cyrillic names.

Open the deployed URL, go to `/library`, switch to Russian, open an exercise.
Expected: GIF renders from the CDN, steps are in Russian, attribution is visible.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add CI and deployment

Typecheck, unit tests, Worker integration tests against a real D1, and an
end-to-end browser pass run on every pull request; main deploys on green."
```

---

## Definition of done

- `pnpm typecheck` and `pnpm test` pass from a clean checkout.
- `data/exercises.seed.json` and `data/taxonomy.ru.json` are committed, and the taxonomy coverage test passes in both directions.
- The deployed Worker serves the SPA and `/api/exercises` from one origin.
- The library is browsable, searchable and filterable in Russian and English at 320px and 1920px.
- Every exercise detail view shows the Gym visual attribution.
- No `style={{...}}` and no Tailwind arbitrary values anywhere in `apps/web`.
- Reduced motion is honoured: the detail view is fully usable with animation disabled.

## Next

Plan **1b — Accounts**: Better Auth on D1, open signup with email verification, `user_settings`, and route protection. Plan **2 — Programs** follows.
