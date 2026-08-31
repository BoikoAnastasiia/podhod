import { expect, test } from "@playwright/test";

test("opens an exercise detail from the library", async ({ page }) => {
  await page.goto("/library");
  await page.getByTestId("exercise-card").first().click();

  await expect(page.getByTestId("exercise-gif")).toBeVisible();
  await expect(page.getByTestId("exercise-steps").getByRole("listitem").first())
    .toBeVisible();
  // The credit is the footer's, once per page. The detail page used to print
  // it a second time under the media as plain text — an unclickable URL a few
  // hundred pixels above the real link saying the same thing. GymVisual's
  // licence asks for no attribution at all (it forbids redistribution and
  // claiming the media as your own); the footer line is a courtesy, and one
  // courtesy is the whole of it.
  await expect(page.getByTestId("attribution")).toHaveCount(0);
  await expect(page.getByTestId("footer-attribution")).toContainText("Gym visual");
});

test("the animation frame is 180px, matching the licence cap", async ({ page }) => {
  await page.goto("/library");
  await page.getByTestId("exercise-card").first().click();
  const box = await page.getByTestId("exercise-gif").boundingBox();
  // getBoundingClientRect() returns subpixel float values (observed:
  // 180.00001525878906, a 2^-16-sized rendering artefact) that fail a bare
  // <= 180 check despite being visually and functionally exactly 180px.
  // Round to pixel resolution before comparing: the licence cap is a whole
  // pixel constraint, not a sub-pixel one, and rounding still catches a
  // real regression (e.g. the historical 439px overflow) just as reliably.
  expect(Math.round(box!.width)).toBeLessThanOrEqual(180);
  expect(Math.round(box!.height)).toBeLessThanOrEqual(180);
});

test("the header's Library link returns to the library", async ({ page }) => {
  // The dedicated back pill is gone (owner's call): the nav link and the
  // browser's own Back cover the same journeys without a duplicate control.
  await page.goto("/library");
  await page.getByTestId("exercise-card").first().click();
  await expect(page.getByTestId("exercise-gif")).toBeVisible();

  await page.getByRole("link", { name: "Library", exact: true }).click();

  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();
});

/**
 * The way out of a detour has to be visible in the detour, on every viewport.
 *
 * The page went without one for a while, on the argument that the header's
 * Library link and the browser's own Back both covered it. Neither quite did:
 * the header link builds a *fresh* library, so it drops the filter, the pages
 * and the place in the grid exactly the way the old useState bug did — and on
 * a phone the browser's control is chrome or a gesture, not something the page
 * offers.
 *
 * The control pops history rather than linking, because the browse is restored
 * by the pop and not by the destination.
 */
for (const [name, viewport] of [
  ["on a desktop viewport", { width: 1440, height: 900 }],
  ["on a phone viewport", { width: 416, height: 714 }],
] as const) {
  test(`${name} an exercise offers the way back to the browse it came from`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/library");
    await page.getByRole("button", { name: "chest" }).click();
    const cards = page.getByTestId("exercise-card");
    await expect(cards.first()).toBeVisible();
    await page.getByRole("button", { name: "Load more" }).click();
    await expect.poll(() => cards.count(), { timeout: 5000 }).toBeGreaterThan(30);
    const paged = await cards.count();

    await cards.first().click();
    const back = page.getByTestId("back-to-library");
    await expect(back).toBeVisible();
    // The same tap target every other control on these pages has to meet.
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await back.click();

    await expect(page.getByRole("button", { name: "chest" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect.poll(() => cards.count(), { timeout: 5000 }).toBe(paged);
  });
}

/**
 * Opened cold — a shared link, a new tab, a reload — there is no history of
 * ours to pop, so the control has to mean the plain library rather than
 * throwing her out of the app to whatever the tab held before.
 */
test("an exercise opened cold still offers a way into the library", async ({ page }) => {
  await page.goto("/library/0040");
  const back = page.getByTestId("back-to-library");
  await expect(back).toBeVisible();

  await back.click();

  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();
});
