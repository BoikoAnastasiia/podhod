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
 * The whole flow on a desktop viewport: a program is one workout. Creating
 * one drops straight into its editor as a dialog over the list, each picked
 * exercise lands instantly as 4×10 with an editable weight, and a reload
 * restores both the server state and the open dialog from `?program=`.
 */
test("builds a workout from nothing", async ({ page }) => {
  await signUp(page, "programs-build");

  await page.goto("/programs");
  await expect(page.getByTestId("programs-empty")).toBeVisible();
  // The empty state leads with the ready-made programs.
  await expect(page.getByTestId("template-gallery")).toBeVisible();

  // Creating opens the editor immediately — no hunting for the new card.
  await page.getByTestId("program-name").fill("monday");
  await page.getByTestId("create-program").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await expect(page.getByTestId("program-title")).toHaveText("monday");
  await expect(page).toHaveURL(/\?program=/);
  await expect(page.getByTestId("entries-empty")).toBeVisible();

  // Three exercises through one picker session — instant adds, panel open.
  await page.getByTestId("add-exercise").click();
  await page.getByTestId("picker-search").fill("push");
  await page.getByTestId("picker-result").first().click();
  await expect(page.getByTestId("day-exercise")).toHaveCount(1);
  // The instant add is the trainer's default: 4 sets, weight in front of you.
  await expect(page.getByTestId("entry-weight").first()).toHaveValue("20");

  await page.getByTestId("picker-search").fill("curl");
  await page.getByTestId("picker-result").first().click();
  await expect(page.getByTestId("day-exercise")).toHaveCount(2);

  // The body-part chips filter the picker the same way the library filters.
  await page.getByRole("button", { name: "upper legs", exact: true }).click();
  await page.getByTestId("picker-search").fill("squat");
  await page.getByTestId("picker-result").first().click();
  await expect(page.getByTestId("day-exercise")).toHaveCount(3);
  await page.getByTestId("picker-close").click();

  // The weight commits from the row — no form, no dialog.
  const firstWeight = page.getByTestId("day-exercise").first().getByTestId("entry-weight");
  await firstWeight.fill("45");
  await firstWeight.press("Enter");
  await expect(firstWeight).toHaveValue("45");

  // Reorder from the row's own controls; the order is server state.
  const firstName = await page.getByTestId("entry-name").first().textContent();
  await page.getByTestId("day-exercise").first().getByTestId("move-down").click();
  await expect(page.getByTestId("entry-name").first()).not.toHaveText(firstName ?? "");

  // A reload must restore the dialog, the order, and the edited weight.
  await page.reload();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await expect(page.getByTestId("day-exercise")).toHaveCount(3);
  await expect(page.getByTestId("entry-name").first()).not.toHaveText(firstName ?? "");
  await expect(page.getByTestId("entry-weight").nth(1)).toHaveValue("45");

  // Closing lands back on the list, which counts what was just built.
  await page.getByTestId("close-program-dialog").click();
  await expect(page).toHaveURL(/\/programs$/);
  const card = page.getByTestId("program-card").filter({ hasText: "monday" });
  await expect(card).toContainText("3 exercises");
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

  await page.getByTestId("add-exercise").click();
  await page.getByTestId("picker-search").fill("squat");
  await page.getByTestId("picker-result").first().click();
  await expect(page.getByTestId("day-exercise")).toHaveCount(1);
  await page.getByTestId("picker-close").click();

  // Edit: switch the entry from the default fixed scheme to RPE; the inline
  // weight field gives way to the scheme summary, which only RPE renders.
  await page.getByTestId("edit-entry").click();
  await page.getByTestId("scheme-kind-rpe").click();
  await page.getByTestId("scheme-submit").click();
  await expect(page.getByTestId("scheme-summary")).toContainText("RPE");
  await expect(page.getByTestId("entry-weight")).toHaveCount(0);

  // Remove asks first — the first click must not delete anything.
  await page.getByTestId("remove-entry").click();
  await expect(page.getByTestId("day-exercise")).toHaveCount(1);
  await page.getByTestId("confirm-remove-entry").click();
  await expect(page.getByTestId("day-exercise")).toHaveCount(0);
  await expect(page.getByTestId("entries-empty")).toBeVisible();

  // Escape is the native dialog's own close path — it must clear the URL too.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("program-dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/programs$/);
});

test("taking a template yields a full editable workout with its icon", async ({ page }) => {
  await signUp(page, "programs-template");
  await page.goto("/programs");

  await page.getByTestId("take-template-leg-day").click();
  // The copy opens in the editor dialog when the replay finishes.
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await expect(page.getByTestId("program-title")).toHaveText("Leg Day");
  await expect(page.getByTestId("program-icon")).toHaveText("🦵");
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
    await page.getByTestId("add-exercise").click();
    await page.getByTestId("picker-search").fill("push");
    await page.getByTestId("picker-result").first().click();
    await expect(page.getByTestId("day-exercise")).toHaveCount(1);
  });
});
