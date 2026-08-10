import { expect, test } from "@playwright/test";

test("the landing page renders a real, non-placeholder home screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PODHOD", level: 1 })).toBeVisible();

  // The exercise count is fetched, not hard-coded — it must resolve to a
  // real positive number rather than staying stuck on the loading copy.
  const stat = page.getByTestId("landing-exercise-count");
  await expect(stat).toContainText(/\d/, { timeout: 5000 });

  // The curated most-popular row, fetched by id from the API.
  await expect(page.getByTestId("popular-exercises")).toBeVisible();
  await expect(page.getByTestId("exercise-card")).toHaveCount(8);

  // Three blog teasers link into the blog section.
  await expect(page.getByTestId("landing-blog-card")).toHaveCount(3);

  // Both footer credits are links now, and the footer belongs to the root
  // layout — pinned to the viewport bottom on every page, not just here.
  await expect(page.getByTestId("footer-attribution")).toHaveAttribute(
    "href",
    /gymvisual\.com/,
  );
  await expect(page.getByRole("link", { name: /GitHub/i })).toHaveAttribute(
    "href",
    /github\.com/,
  );
});

test("a popular card reaches its exercise page", async ({ page }) => {
  // The old hero CTA is gone (the nav's Library link covers it); the cards
  // themselves are the landing's path into the library now.
  await page.goto("/");
  await page.getByTestId("exercise-card").first().click();
  await expect(page).toHaveURL(/\/library\/\d+$/);
  await expect(page.getByTestId("exercise-steps")).toBeVisible();
});

test("a blog teaser reaches its article", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("landing-blog-card").first().click();
  await expect(page).toHaveURL(/\/blog\/[a-z-]+$/);
  await expect(page.getByTestId("blog-article")).toBeVisible();
});

test("landing has no horizontal overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PODHOD", level: 1 })).toBeVisible();
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
  const homeLink = page.getByRole("link", { name: "Home", exact: true });
  const libraryLink = page.getByRole("link", { name: "Library", exact: true });
  await expect(homeLink).toHaveAttribute("aria-current", "page");
  await expect(libraryLink).toBeVisible();
  await expect(libraryLink).not.toHaveAttribute("aria-current", "page");

  await libraryLink.click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("link", { name: "Library", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // Home only matches exactly — it must not stay lit on other routes.
  await expect(page.getByRole("link", { name: "Home", exact: true })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  // The wordmark still returns home from any route. Exact: the blog teaser
  // cards mention PODHOD in their text and would collide on a loose match.
  await page.getByRole("link", { name: "PODHOD", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("the blog lists its three starter articles", async ({ page }) => {
  await page.goto("/blog");
  await expect(page.getByTestId("blog-card")).toHaveCount(3);
  // The first article carries a self-hosted cover image on its card.
  await expect(page.getByTestId("blog-card-image")).toBeVisible();
  await page.getByTestId("blog-card").first().click();
  await expect(page.getByTestId("blog-article")).toBeVisible();
});
