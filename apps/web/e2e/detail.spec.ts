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
  // getBoundingClientRect() returns subpixel float values (observed:
  // 180.00001525878906, a 2^-16-sized rendering artefact) that fail a bare
  // <= 180 check despite being visually and functionally exactly 180px.
  // Round to pixel resolution before comparing: the licence cap is a whole
  // pixel constraint, not a sub-pixel one, and rounding still catches a
  // real regression (e.g. the historical 439px overflow) just as reliably.
  expect(Math.round(box!.width)).toBeLessThanOrEqual(180);
  expect(Math.round(box!.height)).toBeLessThanOrEqual(180);
});

test("the back affordance returns to the library", async ({ page }) => {
  await page.goto("/library");
  await page.getByTestId("exercise-card").first().click();
  await expect(page.getByTestId("exercise-gif")).toBeVisible();

  await page.getByTestId("back-to-library").click();

  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();
});
