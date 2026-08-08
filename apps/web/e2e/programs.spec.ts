import { expect, test, type Page } from "@playwright/test";

/**
 * Per-test-run emails, same reasoning as auth.spec.ts: the dev D1 this suite
 * runs against is not wiped between runs, and each of these tests wants its
 * own empty programs list — a shared account would inherit programs from
 * every earlier run and every earlier test.
 */
function freshEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

const PASSWORD = "correct-horse-e2e-1";

async function signUp(page: Page, tag: string): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(freshEmail(tag));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByTestId("sign-up-submit").click();
  await expect(page.getByTestId("nav-identity")).toBeVisible();
}

test("/programs redirects to sign-in when signed out", async ({ page }) => {
  await page.goto("/programs");
  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fprograms/);
});

/**
 * The whole phase as one path, because the individual pieces passing does not
 * prove they compose: create a program, activate it, add two days, put an
 * exercise with a different scheme in each, reorder the days — then reload and
 * assert against the server's answer, not the local cache's.
 */
test("builds a program from nothing", async ({ page }) => {
  await signUp(page, "programs-build");

  await page.goto("/programs");
  await expect(page.getByTestId("programs-empty")).toBeVisible();

  await page.getByTestId("program-name").fill("Full Body");
  await page.getByTestId("create-program").click();
  const card = page.getByTestId("program-card").filter({ hasText: "Full Body" });
  await expect(card).toBeVisible();

  await card.getByTestId("toggle-active").click();
  await expect(card.getByTestId("active-badge")).toBeVisible();

  await card.getByTestId("program-link").click();
  await expect(page.getByTestId("program-title")).toHaveText("Full Body");

  for (const dayName of ["Day A", "Day B"]) {
    await page.getByTestId("new-day-name").fill(dayName);
    await page.getByTestId("add-day").click();
    await expect(
      page.getByTestId("day-card").filter({ has: page.getByText(dayName, { exact: true }) }),
    ).toBeVisible();
  }

  // Day A gets the default linear scheme.
  const dayA = page.getByTestId("day-card").filter({ hasText: "Day A" });
  await dayA.getByTestId("add-exercise").click();
  await dayA.getByTestId("picker-search").fill("push");
  await dayA.getByTestId("picker-result").first().click();
  await expect(dayA.getByTestId("scheme-step")).toBeVisible();
  await dayA.getByTestId("scheme-submit").click();
  await expect(dayA.getByTestId("day-exercise")).toHaveCount(1);
  // The linear summary renders the deload as a whole percentage — proof the
  // fraction↔percent boundary conversion ran, not just that a row appeared.
  await expect(dayA.getByTestId("scheme-summary")).toContainText("10%");

  // Day B gets a fixed scheme, so the two entries prove the kind switch.
  const dayB = page.getByTestId("day-card").filter({ hasText: "Day B" });
  await dayB.getByTestId("add-exercise").click();
  await dayB.getByTestId("picker-search").fill("curl");
  await dayB.getByTestId("picker-result").first().click();
  await expect(dayB.getByTestId("scheme-step")).toBeVisible();
  await dayB.getByTestId("scheme-kind-fixed").click();
  await dayB.getByTestId("scheme-submit").click();
  await expect(dayB.getByTestId("day-exercise")).toHaveCount(1);
  await expect(dayB.getByTestId("scheme-summary")).toContainText("kg");

  // Reorder by the day-level control's accessible name — the entry rows carry
  // reorder buttons of their own, so a bare move-down testid is ambiguous.
  await page.getByRole("button", { name: "Move Day A later" }).click();
  await expect(page.getByTestId("day-name").first()).toHaveText("Day B");

  // The order must survive a round trip to the server, not just live in the
  // cache the mutation invalidated.
  await page.reload();
  await expect(page.getByTestId("day-name").first()).toHaveText("Day B");
  await expect(page.getByTestId("day-name").nth(1)).toHaveText("Day A");
  await expect(page.getByTestId("day-exercise")).toHaveCount(2);
});

test("activating a second program deactivates the first in the UI", async ({ page }) => {
  await signUp(page, "programs-active");
  await page.goto("/programs");

  for (const name of ["First", "Second"]) {
    await page.getByTestId("program-name").fill(name);
    await page.getByTestId("create-program").click();
    await expect(page.getByTestId("program-card").filter({ hasText: name })).toBeVisible();
  }

  const first = page.getByTestId("program-card").filter({ hasText: "First" });
  const second = page.getByTestId("program-card").filter({ hasText: "Second" });

  await first.getByTestId("toggle-active").click();
  await expect(first.getByTestId("active-badge")).toBeVisible();

  // Activation is an atomic swap server-side; the list must show it moved,
  // not that both are active.
  await second.getByTestId("toggle-active").click();
  await expect(second.getByTestId("active-badge")).toBeVisible();
  await expect(first.getByTestId("active-badge")).toHaveCount(0);
});

test("an added exercise's scheme can be edited and the entry removed", async ({ page }) => {
  await signUp(page, "programs-edit");
  await page.goto("/programs");

  await page.getByTestId("program-name").fill("Edit Me");
  await page.getByTestId("create-program").click();
  await page.getByTestId("program-link").click();

  await page.getByTestId("new-day-name").fill("Only Day");
  await page.getByTestId("add-day").click();
  const day = page.getByTestId("day-card").filter({ hasText: "Only Day" });
  await expect(day).toBeVisible();

  await day.getByTestId("add-exercise").click();
  await day.getByTestId("picker-search").fill("squat");
  await day.getByTestId("picker-result").first().click();
  await day.getByTestId("scheme-submit").click();
  await expect(day.getByTestId("day-exercise")).toHaveCount(1);

  // Edit: switch the entry from linear to RPE and check the summary follows.
  await day.getByTestId("edit-entry").click();
  await day.getByTestId("scheme-kind-rpe").click();
  await day.getByTestId("scheme-submit").click();
  await expect(day.getByTestId("scheme-summary")).toContainText("RPE");

  // Remove asks first — the first click must not delete anything.
  await day.getByTestId("remove-entry").click();
  await expect(day.getByTestId("day-exercise")).toHaveCount(1);
  await day.getByTestId("confirm-remove-entry").click();
  await expect(day.getByTestId("day-exercise")).toHaveCount(0);
  await expect(day.getByTestId("day-empty")).toBeVisible();
});
