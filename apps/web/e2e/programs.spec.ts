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
 * The whole hand-building path as one flow, on a desktop viewport: creating a
 * program drops straight into its editor as a dialog over the list, days and
 * exercises are one click each, and a reload restores the open dialog from
 * the URL — the editor's state lives in `?program=`, not in component memory.
 */
test("builds a program from nothing", async ({ page }) => {
  await signUp(page, "programs-build");

  await page.goto("/programs");
  await expect(page.getByTestId("programs-empty")).toBeVisible();
  // The empty state leads with the ready-made programs.
  await expect(page.getByTestId("template-gallery")).toBeVisible();

  // Creating opens the editor immediately — no hunting for the new card.
  await page.getByTestId("program-name").fill("Full Body");
  await page.getByTestId("create-program").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await expect(page.getByTestId("program-title")).toHaveText("Full Body");
  await expect(page).toHaveURL(/\?program=/);

  // Days arrive named, no form.
  await page.getByTestId("add-day").click();
  await expect(page.getByTestId("day-name").first()).toHaveText("Day 1");
  await page.getByTestId("add-day").click();
  await expect(page.getByTestId("day-card")).toHaveCount(2);

  // Two exercises through one picker session — instant adds, panel stays open.
  const day1 = page.getByTestId("day-card").filter({ hasText: "Day 1" });
  await day1.getByTestId("add-exercise").click();
  await day1.getByTestId("picker-search").fill("push");
  await day1.getByTestId("picker-result").first().click();
  await expect(day1.getByTestId("day-exercise")).toHaveCount(1);
  // The default linear summary renders its deload as a whole percentage —
  // proof the fraction↔percent boundary conversion ran on the instant add.
  await expect(day1.getByTestId("scheme-summary").first()).toContainText("10%");
  await day1.getByTestId("picker-search").fill("curl");
  await day1.getByTestId("picker-result").first().click();
  await expect(day1.getByTestId("day-exercise")).toHaveCount(2);
  await day1.getByTestId("picker-close").click();

  const day2 = page.getByTestId("day-card").filter({ hasText: "Day 2" });
  await day2.getByTestId("add-exercise").click();
  await day2.getByTestId("picker-search").fill("squat");
  await day2.getByTestId("picker-result").first().click();
  await expect(day2.getByTestId("day-exercise")).toHaveCount(1);

  // Reorder by the day-level control's accessible name — the entry rows carry
  // reorder buttons of their own, so a bare move-down testid is ambiguous.
  await page.getByRole("button", { name: "Move Day 1 later" }).click();
  await expect(page.getByTestId("day-name").first()).toHaveText("Day 2");

  // A reload must restore both the server state and the open dialog.
  await page.reload();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await expect(page.getByTestId("day-name").first()).toHaveText("Day 2");
  await expect(page.getByTestId("day-name").nth(1)).toHaveText("Day 1");
  await expect(page.getByTestId("day-exercise")).toHaveCount(3);

  // Closing lands back on the list, where the card can be activated.
  await page.getByTestId("close-program-dialog").click();
  await expect(page).toHaveURL(/\/programs$/);
  const card = page.getByTestId("program-card").filter({ hasText: "Full Body" });
  await card.getByTestId("toggle-active").click();
  await expect(card.getByTestId("active-badge")).toBeVisible();
});

test("activating a second program deactivates the first in the UI", async ({ page }) => {
  await signUp(page, "programs-active");
  await page.goto("/programs");

  for (const name of ["First", "Second"]) {
    await page.getByTestId("program-name").fill(name);
    await page.getByTestId("create-program").click();
    // Each create opens its editor; close it to get back to the list.
    await expect(page.getByTestId("program-dialog")).toBeVisible();
    await page.getByTestId("close-program-dialog").click();
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
  await expect(page.getByTestId("program-dialog")).toBeVisible();

  await page.getByTestId("add-day").click();
  const day = page.getByTestId("day-card").filter({ hasText: "Day 1" });
  await expect(day).toBeVisible();

  await day.getByTestId("add-exercise").click();
  await day.getByTestId("picker-search").fill("squat");
  await day.getByTestId("picker-result").first().click();
  await expect(day.getByTestId("day-exercise")).toHaveCount(1);
  await day.getByTestId("picker-close").click();

  // Edit: switch the entry from the default linear to RPE, summary follows.
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

  // Escape is the native dialog's own close path — it must clear the URL too.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("program-dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/programs$/);
});

test("taking a template yields a full editable program with its icon", async ({ page }) => {
  await signUp(page, "programs-template");
  await page.goto("/programs");

  await page.getByTestId("take-template-leg-day").click();
  // The copy opens in the editor dialog when the replay finishes.
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await expect(page.getByTestId("program-title")).toHaveText("Leg Day");
  await expect(page.getByTestId("program-icon")).toHaveText("🦵");
  await expect(page.getByTestId("day-card")).toHaveCount(1);
  await expect(page.getByTestId("day-exercise")).toHaveCount(5);

  // It is an ordinary program: delete an entry to prove it's editable.
  await page.getByTestId("remove-entry").first().click();
  await page.getByTestId("confirm-remove-entry").first().click();
  await expect(page.getByTestId("day-exercise")).toHaveCount(4);

  // And the icon is the user's to change, from the preset row.
  await page.getByTestId("change-icon").click();
  await page.getByTestId("icon-option-💪").click();
  await expect(page.getByTestId("program-icon")).toHaveText("💪");
  await page.getByTestId("close-program-dialog").click();
  await expect(page.getByTestId("program-card").filter({ hasText: "Leg Day" })).toContainText(
    "💪",
  );
});

test.describe("on a phone viewport", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("creating a program opens the full page, not a dialog", async ({ page }) => {
    await signUp(page, "programs-mobile");
    await page.goto("/programs");

    await page.getByTestId("program-name").fill("Phone Plan");
    await page.getByTestId("create-program").click();

    // Same editor, framed as a page — a dialog would cram the whole builder
    // into a keyhole on this width.
    await expect(page).toHaveURL(/\/programs\/[A-Za-z0-9_-]+$/);
    await expect(page.getByTestId("program-dialog")).toHaveCount(0);
    await expect(page.getByTestId("program-title")).toHaveText("Phone Plan");
    await page.getByTestId("add-day").click();
    await expect(page.getByTestId("day-name").first()).toHaveText("Day 1");
  });
});
