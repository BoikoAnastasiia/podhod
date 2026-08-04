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
