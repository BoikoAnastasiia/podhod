import { expect, test } from "@playwright/test";

/**
 * The library reserves the space its results will occupy while they load.
 *
 * Without it the page is a search box, some chips and one line of text — a few
 * hundred pixels — so the footer sits mid-screen and is then shoved below the
 * fold when the grid lands. Measured on a throttled connection, that single
 * navigation scored 0.203 cumulative layout shift, effectively all of it the
 * footer moving twice; with the placeholders it is 0.000.
 *
 * The request is delayed here because on a fast connection the loading state is
 * over before anything can observe it.
 */
test("the library holds the space for its results while they load", async ({ page }) => {
  await page.route("**/api/exercises**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.goto("/library");

  const skeleton = page.getByTestId("library-skeleton");
  await expect(skeleton).toBeVisible();
  // Enough placeholders to fill a viewport, in the same grid as the results.
  expect(await skeleton.locator("li").count()).toBeGreaterThanOrEqual(8);

  // The footer must already be where the real content will leave it: below the
  // fold, not floating in the middle of the page.
  const footerTop = (await page.getByRole("contentinfo").boundingBox())?.y ?? 0;
  expect(footerTop).toBeGreaterThan(page.viewportSize()!.height * 0.7);

  // And it gives way to the real thing.
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();
  await expect(skeleton).toHaveCount(0);
});

test("browses, searches and filters the library", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();

  // "bench press" alone matches 30+ variants in the real 1,324-exercise
  // library (barbell/dumbbell/cable/decline/incline/...), so it doesn't
  // narrow to one card the way the brief's literal search term assumes.
  // "reverse grip bench press" is verified unique in the seeded data and
  // still contains "bench press" for the text assertion below.
  await page.getByPlaceholder(/search/i).fill("reverse grip bench press");
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

test("loading more exercises grows the result count", async ({ page }) => {
  await page.goto("/library");
  const cards = page.getByTestId("exercise-card");
  await expect(cards.first()).toBeVisible();
  const initialCount = await cards.count();

  await page.getByRole("button", { name: "Load more" }).click();

  // The full 1,324-exercise library pages 30 at a time with no filter
  // applied, so a single "load more" click must strictly grow the count
  // rather than silently topping out at the first page.
  await expect
    .poll(() => cards.count(), { timeout: 5000 })
    .toBeGreaterThan(initialCount);
});

test("filter chips meet the minimum tap target height", async ({ page }) => {
  await page.goto("/library");
  const chip = page.getByRole("button", { name: "chest" });
  const box = await chip.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("thumbnail media stays within the 180px licence cap on a wide viewport", async ({
  page,
}) => {
  // A regression guard: `width`/`height` HTML attributes alone don't bound
  // the rendered box — a computed style (an unbounded grid track feeding an
  // unbounded `size-full` image) can still win. Measuring the real
  // getBoundingClientRect() is the only way this stays caught.
  //
  // `.exercise-thumb` is the clipped frame around the <img>, not the <img>
  // itself: the card hover effect scales the image up to 1.03x *inside*
  // this frame (overflow: hidden) to get a zoom effect without the
  // rendered box ever exceeding the licence cap. Measuring the <img>
  // directly would make this test flap on hover (185.4px) or, worse,
  // invite someone to "fix" the flake by raising the 180 limit — measuring
  // the frame is what actually reflects the licence-bound box, and it
  // stays exactly 180px regardless of the image's own transform.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/library");
  const thumb = page.locator(".exercise-thumb").first();
  const box = await thumb.boundingBox();
  // getBoundingClientRect() returns subpixel float values that can land a
  // hair over 180 (e.g. 180.00001525878906) despite being exactly 180px in
  // practice. Round to pixel resolution: the licence cap is a whole-pixel
  // constraint, and rounding still catches a real regression just as well
  // as a bare comparison would.
  expect(Math.round(box!.width)).toBeLessThanOrEqual(180);
  expect(Math.round(box!.height)).toBeLessThanOrEqual(180);
});

/**
 * The detour into an exercise and back is the library's most ordinary
 * gesture, and it used to throw the browse away: the filter chip and the
 * search box lived in component state, so unmounting the route on the way to
 * `/library/$id` destroyed both. Coming back remounted them empty, which also
 * changed the query key underneath the infinite list — so the second page the
 * owner had paged down to was gone too, and she was looking at page one of an
 * unfiltered library.
 *
 * The filter belongs in the URL for the reason `$id`'s `?from=` gives: it has
 * to survive a reload and a shared link, not only a history entry. Keeping it
 * there fixes the pages as a consequence — the query key comes back identical,
 * so React Query hands back every page it already holds.
 *
 * The place in the list is the third part of "where I was", and it needs the
 * router's `scrollRestoration` — without it every arrival, pop included, is
 * scrolled to the top, which on a grid paged sixty cards deep leaves the card
 * she was just reading far below the fold.
 */
test("returning from an exercise keeps the filter and the pages already loaded", async ({
  page,
}) => {
  await page.goto("/library");
  const cards = page.getByTestId("exercise-card");
  await expect(cards.first()).toBeVisible();

  const chip = page.getByRole("button", { name: "chest" });
  await chip.click();
  await expect(cards.first()).toContainText(/chest/i);
  // The filter is in the location, not only in the component.
  expect(page.url()).toContain("bodyPart=chest");

  await page.getByRole("button", { name: "Load more" }).click();
  const firstPage = 30;
  await expect.poll(() => cards.count(), { timeout: 5000 }).toBeGreaterThan(firstPage);
  const paged = await cards.count();

  // The last card of the second page — one only reachable by paging, so its
  // presence afterwards proves the depth came back and not just the filter.
  const lastHref = await cards.nth(paged - 1).getAttribute("href");
  // Down to the bottom, where the second page actually is. The last card is
  // the one opened deliberately: anything higher would be scrolled into view
  // before the click, and the position restored afterwards would be that
  // scroll rather than the one this test means to check.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const scrolledTo = await page.evaluate(() => window.scrollY);
  expect(scrolledTo).toBeGreaterThan(0);

  await cards.nth(paged - 1).click();
  await expect(page.getByTestId("exercise-gif")).toBeVisible();

  await page.goBack();

  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => cards.count(), { timeout: 5000 }).toBe(paged);
  await expect(cards.nth(paged - 1)).toHaveAttribute("href", lastHref!);
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBe(
    scrolledTo,
  );
});

/**
 * A browse is a link, so it also has to survive being typed badly.
 *
 * `bodyPart` is checked against the ten real taxonomy values because an
 * invented one reaches the API happily and comes back empty — "nothing matches
 * those filters" with no chip lit to explain it, and no way out but editing the
 * URL by hand. The check is easy to write and not work: the router merges the
 * validator's result onto the parsed search instead of replacing it, so a
 * rejected key has to be returned as `undefined` rather than left out. Left
 * out, the URL's own value simply survives and the guard does nothing — which
 * is exactly what the first version of it did.
 */
test("a made-up body part in the URL is ignored rather than filtering to nothing", async ({
  page,
}) => {
  await page.goto("/library?bodyPart=elbows");
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();
});

/** And the other end of it: an emptied browse leaves no debris in the URL. */
test("clearing the filter leaves a clean library URL", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();

  const chip = page.getByRole("button", { name: "chest" });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "false");

  await expect(page.getByTestId("exercise-card").first()).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
});
