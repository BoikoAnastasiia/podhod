import { expect, test, type Page } from "@playwright/test";

/** The language toggle lives inside the user menu since the 3e design pass. */
async function switchToRussian(page: Page): Promise<void> {
  await page.getByTestId("user-menu").click();
  await page.getByTestId("lang-ru").click();
  await page.keyboard.press("Escape");
}

test("switches the library to Russian", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();

  await switchToRussian(page);

  // The first card by id order is exercise 0001 ("3/4 sit-up"), body part
  // "waist" and equipment "body weight". Assert both known translations
  // rather than a bare Cyrillic-anywhere regex, which would still pass if
  // only one of the two label fields (say equipment) stopped translating.
  const first = page.getByTestId("exercise-card").first();
  await expect(first).toContainText("пресс и корпус · собственный вес");
  await expect(page.getByRole("button", { name: /спина|грудь/ }).first())
    .toBeVisible();
});

test("the toggle shows both languages and marks the active one", async ({ page }) => {
  await page.goto("/library");
  await page.getByTestId("user-menu").click();

  // A real toggle: both options visible at once, state on the control —
  // the old single button labelled with the *other* language was the
  // confusion this design pass removed.
  await expect(page.getByTestId("lang-en")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("lang-ru")).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId("lang-ru").click();
  await expect(page.getByTestId("lang-ru")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("lang-en")).toHaveAttribute("aria-pressed", "false");
});

test("Russian labels do not overflow a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/library");
  await switchToRussian(page);
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
