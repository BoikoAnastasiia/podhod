import { expect, test } from "@playwright/test";

test("the landing page renders a real, non-placeholder home screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Подход", level: 1 })).toBeVisible();

  // The exercise count is fetched, not hard-coded — it must resolve to a
  // real positive number rather than staying stuck on the loading copy.
  const stat = page.getByTestId("landing-exercise-count");
  await expect(stat).toContainText(/\d/, { timeout: 5000 });

  // Proof the content is real: actual exercise thumbnails from the API.
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();

  await expect(page.getByTestId("attribution")).toContainText("Gym visual");
  await expect(page.getByRole("link", { name: /GitHub/i })).toHaveAttribute(
    "href",
    /github\.com/,
  );
});

test("the CTA reaches the library", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("landing-cta").click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();
});

test("landing has no horizontal overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await expect(page.getByTestId("landing-cta")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test("thumbnails on the landing page respect the 180px licence cap", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  const thumb = page.locator(".exercise-thumb").first();
  await expect(thumb).toBeVisible();
  const box = await thumb.boundingBox();
  expect(Math.round(box!.width)).toBeLessThanOrEqual(180);
  expect(Math.round(box!.height)).toBeLessThanOrEqual(180);
});

test("the nav marks the active route and navigates", async ({ page }) => {
  await page.goto("/");
  const libraryLink = page.getByRole("link", { name: "Library", exact: true });
  await expect(libraryLink).toBeVisible();
  await expect(libraryLink).not.toHaveAttribute("aria-current", "page");

  await libraryLink.click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("link", { name: "Library", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // The wordmark still returns home from any route.
  await page.getByRole("link", { name: "Подход" }).click();
  await expect(page).toHaveURL(/\/$/);
});
