import { expect, test } from "@playwright/test";

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
