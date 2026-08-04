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
