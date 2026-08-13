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
  // A positive signal, not an absence: autoSignIn lands the fresh account on
  // the home page. (Asserting sign-in-link count 0 passed vacuously while
  // the session query was still pending, racing the next navigation.)
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("sign-in-link")).toHaveCount(0);
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

  // Creating opens the editor immediately — no form, a default name.
  await page.getByTestId("create-program").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await expect(page.getByTestId("program-title")).toHaveText("New program");

  // The title renames in place — the only naming step left, and optional.
  await page.getByTestId("rename-program").click();
  await page.getByTestId("program-name-input").fill("monday");
  await page.getByTestId("save-program-name").click();
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

  // The whole card is the entrance now (no Open pill): clicking anywhere
  // outside the action row reopens the editor. The count text is a safe
  // "anywhere" — it is not a control of its own.
  await card.getByText("3 exercises").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
});

/**
 * The confirmation the owner asked for after reporting that adding an exercise
 * gave no sign it had worked.
 *
 * The geometry assertion is the point of the test, not decoration: the toast
 * clears a *fixed* header whose height changes, so it is positioned from a
 * measurement. The first implementation read that measurement from a CSS
 * variable that could go stale at 0, which put the toast inside the black band
 * — visible in a screenshot, invisible to any assertion that only checked the
 * text.
 */
test("adding an exercise confirms it by name, below the header", async ({ page }) => {
  await signUp(page, "programs-toast");
  await page.goto("/programs");

  await page.getByTestId("create-program").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await page.getByTestId("add-exercise").click();
  await page.getByTestId("picker-search").fill("air bike");

  const picked = page.getByTestId("picker-result").first();
  const name = await picked.getByTestId("picker-name").textContent();
  await picked.click();

  const toast = page.getByTestId("toast");
  await expect(toast).toHaveText(`${name} was added to New program!`);

  const toastBox = await toast.boundingBox();
  const headerBox = await page.getByRole("banner").boundingBox();
  expect(toastBox && headerBox && toastBox.y >= headerBox.y + headerBox.height).toBe(true);

  /*
   * The assertion that matters, because this runs with the editor open as a
   * modal <dialog>: the first implementation placed the toast at exactly the
   * right coordinates *underneath* it. showModal() promotes the dialog to the
   * top layer, which no z-index reaches, so the toast was drawn behind it while
   * every assertion above still passed.
   *
   * Being in the top layer itself is what fixes that, and :popover-open is how
   * you ask. Hit-testing looks like the more direct question and is not: a
   * modal makes everything outside it inert, and inert elements are skipped by
   * elementFromPoint whether or not they are painted on top — that check failed
   * against a build whose toast was plainly visible over the dialog.
   */
  const inTopLayer = await page.evaluate(() =>
    document.querySelector('[data-testid="toast-viewport"]')?.matches(":popover-open") ?? false,
  );
  expect(inTopLayer).toBe(true);

  // And it takes itself away rather than sitting there for the rest of the session.
  await expect(toast).toBeHidden({ timeout: 10_000 });
});

/**
 * The page behind the editor stays where it was left.
 *
 * Two separate leaks, both real before this: a modal <dialog> does not lock the
 * document's scroll, so the wheel over the backdrop moved the list behind it;
 * and the dialog's own scroller chained into that document once it hit its
 * bottom, so a long picker list scrolled the page the moment it ran out.
 */
test("the programs list does not scroll behind the open editor", async ({ page }) => {
  await signUp(page, "programs-scrolllock");
  await page.goto("/programs");

  // Enough programs that the list behind the dialog is genuinely scrollable —
  // otherwise this test passes without testing anything.
  for (let i = 0; i < 4; i++) {
    await page.getByTestId("create-program").click();
    await expect(page.getByTestId("program-dialog")).toBeVisible();
    await page.getByTestId("close-program-dialog").click();
    await expect(page.getByTestId("program-dialog")).toHaveCount(0);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight),
  ).toBe(true);

  // The count text, not the card's centre: the action row sits there and stops
  // the click from reaching the card.
  await page.getByTestId("program-card").first().getByText("No exercises yet").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  const before = await page.evaluate(() => window.scrollY);

  // Over the backdrop, to the left of the dialog box.
  await page.mouse.move(10, 400);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  // And over the dialog itself, once its own scroller has nothing left to give.
  await page.evaluate(() => {
    const dialog = document.querySelector("dialog[open]");
    if (dialog) dialog.scrollTop = dialog.scrollHeight;
  });
  const box = await page.getByTestId("program-dialog").boundingBox();
  await page.mouse.move((box?.x ?? 0) + 40, (box?.y ?? 0) + 200);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  // The lock has to let go again — one that leaks freezes the whole app, which
  // is a far worse bug than the one being fixed.
  await page.getByTestId("close-program-dialog").click();
  await expect(page.getByTestId("program-dialog")).toHaveCount(0);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
});

/**
 * The picker's results must never blink out while you type.
 *
 * The search text and the body-part chip are both part of the query key, so
 * every keystroke is a different query — and a different query starts empty.
 * The list was therefore being torn down and replaced by a "Loading…" line on
 * every character, which reads as the whole dialog flashing. Sampling the row
 * count per animation frame is the only way to see it from a test: by the time
 * any assertion settles, the list is back.
 */
test("the exercise picker never empties while the search is being typed", async ({ page }) => {
  await signUp(page, "programs-flicker");
  await page.goto("/programs");

  await page.getByTestId("create-program").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await page.getByTestId("add-exercise").click();
  await expect(page.getByTestId("picker-result").first()).toBeVisible();

  const emptyFrames = await page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>('[data-testid="picker-search"]');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!input || !setValue) return -1;

    const counts: number[] = [];
    let watching = true;
    const tick = () => {
      const list = document.querySelector('[data-testid="exercise-picker"] ul');
      counts.push(list ? list.children.length : 0);
      if (watching) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    for (const text of ["a", "ai", "air"]) {
      setValue.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    watching = false;
    return counts.filter((n) => n === 0).length;
  });

  expect(emptyFrames).toBe(0);
});

/**
 * The duplicate that prompted the rule: nothing confirmed the first tap, so the
 * same exercise got tapped twice and landed twice. The picker now marks what is
 * already in the program and refuses the second tap; the API refuses it too, so
 * the rule does not depend on the button being disabled.
 */
test("the picker refuses a second tap, but the row can be duplicated on purpose", async ({
  page,
}) => {
  await signUp(page, "programs-dupe");
  await page.goto("/programs");

  await page.getByTestId("create-program").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await page.getByTestId("add-exercise").click();
  // A barbell movement on purpose: the point of duplicating is two weights, and
  // only an exercise that takes an external load has one.
  await page.getByTestId("picker-search").fill("barbell full squat");

  const picked = page.getByTestId("picker-result").first();
  await picked.click();
  await expect(page.getByTestId("day-exercise")).toHaveCount(1);

  // The accident: the row it came from says so, and cannot be tapped again.
  await expect(picked.getByTestId("picker-added")).toBeVisible();
  await expect(picked).toBeDisabled();
  await page.getByTestId("picker-close").click();

  /*
   * The intent: heavy set then back-off set is one exercise twice. The copy
   * carries the original's scheme and lands directly beneath it — not at the
   * end of the list, which is what the append-only add endpoint would do on its
   * own.
   */
  await page.getByTestId("day-exercise").first().getByTestId("duplicate-entry").click();
  await expect(page.getByTestId("day-exercise")).toHaveCount(2);
  await expect(page.getByTestId("entry-name").nth(1)).toHaveText("barbell full squat");
  await expect(page.getByTestId("entry-weight").nth(1)).toHaveValue("20");

  // Two rows, two weights — the whole point of allowing the duplicate.
  const secondWeight = page.getByTestId("day-exercise").nth(1).getByTestId("entry-weight");
  await secondWeight.fill("40");
  await secondWeight.press("Enter");
  await page.reload();
  await expect(page.getByTestId("entry-weight").first()).toHaveValue("20");
  await expect(page.getByTestId("entry-weight").nth(1)).toHaveValue("40");
});


/**
 * A row's thumbnail is a way out to the exercise and back again.
 *
 * The return trip is the part worth testing: it is carried by `?from=` rather
 * than session history, precisely so it survives a reload or a pasted link —
 * so the test reloads the library page before pressing back, which is exactly
 * the case `history.back()` would fail.
 */
test("an entry's preview opens the exercise and comes back to the program", async ({ page }) => {
  await signUp(page, "programs-preview");
  await page.goto("/programs");

  await page.getByTestId("create-program").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await page.getByTestId("add-exercise").click();
  await page.getByTestId("picker-search").fill("air bike");
  await page.getByTestId("picker-result").first().click();
  await expect(page.getByTestId("day-exercise")).toHaveCount(1);
  await page.getByTestId("picker-close").click();

  await page.getByTestId("entry-preview").click();
  await expect(page).toHaveURL(/\/library\/\d+\?from=/);
  // By name, not by position: the program dialog's own <h1> is still in the
  // DOM for the moment the route transition takes.
  await expect(page.getByRole("heading", { name: "air bike", level: 1 })).toBeVisible();

  // Reload first: the way back must not depend on where the tab has been.
  await page.reload();
  await page.getByTestId("back-to-program").click();

  await expect(page).toHaveURL(/\/programs\?program=/);
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await expect(page.getByTestId("day-exercise")).toHaveCount(1);
});

/**
 * "walk elliptical cross trainer · 4×10 · 20 kg" is the row that prompted this:
 * every exercise used to arrive with the same weight-based default, and 451 of
 * the library's 1,324 carry no external load at all.
 *
 * The prescription now follows the equipment, and the editor offers only the
 * kinds the movement can take — the API enforces the same rule, so a hand-made
 * request cannot write kilograms onto a treadmill either.
 */
test("a prescription is written in the unit the exercise actually takes", async ({ page }) => {
  await signUp(page, "programs-loadtype");
  await page.goto("/programs");

  await page.getByTestId("create-program").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await page.getByTestId("add-exercise").click();

  const addFirstMatch = async (query: string) => {
    await page.getByTestId("picker-search").fill(query);
    await page.getByTestId("picker-result").first().click();
  };

  await addFirstMatch("walk elliptical");
  await addFirstMatch("clock push-up");
  await addFirstMatch("barbell full squat");
  await expect(page.getByTestId("day-exercise")).toHaveCount(3);
  await page.getByTestId("picker-close").click();

  const rows = page.getByTestId("day-exercise");
  // Time, with no reps and no kilograms anywhere in the line.
  await expect(rows.nth(0)).toContainText("1×20 min");
  await expect(rows.nth(0)).not.toContainText("kg");
  await expect(rows.nth(0).getByTestId("entry-weight")).toHaveCount(0);

  // Reps, no weight field.
  await expect(rows.nth(1)).toContainText("3×12");
  await expect(rows.nth(1).getByTestId("entry-weight")).toHaveCount(0);

  // A barbell still gets its weight, editable on the row as before.
  await expect(rows.nth(2).getByTestId("entry-weight")).toHaveValue("20");

  // The editor offers only what the movement can take.
  await rows.nth(0).getByTestId("edit-entry").click();
  await expect(rows.nth(0).getByTestId("scheme-kind-duration")).toBeVisible();
  await expect(rows.nth(0).getByTestId("scheme-kind-fixed")).toHaveCount(0);
  await expect(rows.nth(0).getByTestId("scheme-kind-bodyweight")).toHaveCount(0);
  await rows.nth(0).getByTestId("edit-entry").click();

  await rows.nth(2).getByTestId("edit-entry").click();
  await expect(rows.nth(2).getByTestId("scheme-kind-linear")).toBeVisible();
  await expect(rows.nth(2).getByTestId("scheme-kind-duration")).toHaveCount(0);
});

test("activating a second program deactivates the first in the UI", async ({ page }) => {
  await signUp(page, "programs-active");
  await page.goto("/programs");

  for (const name of ["First", "Second"]) {
    await page.getByTestId("create-program").click();
    // Each create opens its editor; rename there, close, back to the list.
    await expect(page.getByTestId("program-dialog")).toBeVisible();
    await page.getByTestId("rename-program").click();
    await page.getByTestId("program-name-input").fill(name);
    await page.getByTestId("save-program-name").click();
    await expect(page.getByTestId("program-title")).toHaveText(name);
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

  await page.getByTestId("create-program").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();

  await page.getByTestId("add-exercise").click();
  await page.getByTestId("picker-search").fill("squat");

  // Every result carries a thumbnail — a beginner recognises a picture
  // where a name like "clean-grip front squat" is just noise.
  await expect(page.getByTestId("picker-thumb").first()).toBeVisible();

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
  // Scoped to the dialog: the template cards behind it carry icons of their own.
  const editorIcon = page.getByTestId("program-dialog").getByTestId("program-icon");
  await expect(editorIcon).toHaveAttribute("data-icon", "quads");
  await expect(page.getByTestId("day-exercise")).toHaveCount(5);

  // It is an ordinary program: delete an entry to prove it's editable.
  await page.getByTestId("remove-entry").first().click();
  await page.getByTestId("confirm-remove-entry").first().click();
  await expect(page.getByTestId("day-exercise")).toHaveCount(4);

  // And the icon is the user's to change: the icon itself opens the panel.
  await page.getByTestId("change-icon").click();
  await expect(page.getByTestId("icon-panel")).toBeVisible();
  await page.getByTestId("icon-option-biceps").click();
  await expect(editorIcon).toHaveAttribute("data-icon", "biceps");

  // Colour rides along with it, and survives the round trip to the list.
  await page.getByTestId("icon-color-blue").click();
  await expect(editorIcon).toHaveCSS("color", "rgb(59, 130, 246)");
  // Escape closes the panel: it is a real popover, not a div we manage.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("icon-panel")).toBeHidden();

  await page.getByTestId("close-program-dialog").click();
  await expect(
    page.getByTestId("program-card").filter({ hasText: "Leg Day" }).getByTestId("program-icon"),
  ).toHaveAttribute("data-icon", "biceps");
});

test("the header stays pinned to the top of the page while the page scrolls", async ({ page }) => {
  await signUp(page, "programs-sticky");
  await page.goto("/library");

  const header = page.getByRole("banner");
  const before = await header.boundingBox();
  await page.mouse.wheel(0, 1200);
  // A sticky header keeps its viewport position no matter how far the page
  // moves underneath it; an unpinned one scrolls away to a negative y.
  await expect
    .poll(async () => (await header.boundingBox())?.y)
    .toBe(before?.y);
});

/**
 * The choreography is emphasis, never the thing conveying state — so someone who
 * has asked their system for stillness gets the app without any of it, and every
 * outcome unchanged.
 *
 * Asserted through the thumbnail's size because that is what the flight
 * animates: it leaves the picker card at 96px and lands in the row at 56px, so
 * any frame wider than the row is the animation running. Under reduced motion
 * there must be no such frame.
 */
/**
 * The editor must not change size while its list rearranges.
 *
 * This is a regression, and it was caught on a screen recording rather than by
 * anything here: the choreography used Flip's `absolute` option, which lifts
 * every row out of flow for the duration, so the list collapsed to 0px, the
 * dialog shrank to fit its suddenly-empty content, and the whole editor imploded
 * and sprang back on every reorder and delete. Measured at the time: list
 * 1784px → 0px, dialog 860px → 194px.
 *
 * Nothing else here would have noticed. Every assertion about rows, counts and
 * order passed throughout, because the end state was always correct — only the
 * half-second in between was wrong.
 */
test("the editor holds its size while the list rearranges", async ({ page }) => {
  await signUp(page, "programs-nocollapse");
  await page.goto("/programs");

  await page.getByTestId("create-program").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await page.getByTestId("add-exercise").click();
  for (const query of ["barbell bench press", "barbell full squat", "barbell deadlift"]) {
    await page.getByTestId("picker-search").fill(query);
    await page.getByTestId("picker-result").first().click();
  }
  await expect(page.getByTestId("day-exercise")).toHaveCount(3);
  await page.getByTestId("picker-close").click();

  const collapse = await page.evaluate(async () => {
    const dialog = document.querySelector("dialog[open]");
    const list = document.querySelector("[data-flip-row]")?.parentElement;
    if (!dialog || !list) return null;

    const before = {
      dialog: dialog.getBoundingClientRect().height,
      list: list.getBoundingClientRect().height,
    };
    const rows = document.querySelectorAll('[data-testid="day-exercise"]');
    rows[0]?.querySelector<HTMLButtonElement>('[data-testid="move-down"]')?.click();

    let smallestList = Infinity;
    let smallestDialog = Infinity;
    for (let frame = 0; frame < 50; frame++) {
      smallestList = Math.min(smallestList, list.getBoundingClientRect().height);
      smallestDialog = Math.min(smallestDialog, dialog.getBoundingClientRect().height);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return { before, smallestList, smallestDialog };
  });

  // Half the starting height is a generous floor — the failure was total.
  expect(collapse!.smallestList).toBeGreaterThan(collapse!.before.list * 0.5);
  expect(collapse!.smallestDialog).toBeGreaterThan(collapse!.before.dialog * 0.5);
});

test.describe("with reduced motion", () => {
  test("adds the exercise with no flight, and the row is simply there", async ({ page }) => {
    await signUp(page, "programs-reduced");
    /*
     * Set explicitly rather than through `test.use({ reducedMotion })`, which
     * this project's config does not deliver to the page — checked directly:
     * under it the page still reported `(prefers-reduced-motion: reduce)` as
     * false, so a test relying on it would assert nothing while looking
     * thorough.
     */
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/programs");

    await page.getByTestId("create-program").click();
    await expect(page.getByTestId("program-dialog")).toBeVisible();
    await page.getByTestId("add-exercise").click();
    await page.getByTestId("picker-search").fill("barbell bench press");
    await page.getByTestId("picker-result").first().click();
    await expect(page.getByTestId("day-exercise")).toHaveCount(1);

    const widths = await page.evaluate(async () => {
      const seen: number[] = [];
      for (let frame = 0; frame < 40; frame++) {
        const thumbs = document.querySelectorAll("[data-flip-row] [data-flip-thumb]");
        const last = thumbs[thumbs.length - 1];
        if (last) seen.push(Math.round(last.getBoundingClientRect().width));
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return [...new Set(seen)];
    });
    expect(widths).toEqual([56]);

    // And the work itself still happened.
    await expect(page.getByTestId("entry-name")).toHaveText("barbell bench press");
  });
});

test.describe("on a phone viewport", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  /**
   * The regression this guards is a feedback loop, not a styling slip. While
   * the header was `position: sticky` and therefore in flow, collapsing the nav
   * row deleted ~48px from above the viewport, scroll anchoring pushed the
   * scroll position up by the same 48px to compensate, the hook read that as
   * scrolling up and expanded the row again — and the header flickered between
   * the two states at frame rate for as long as the page sat there. Hence the
   * settle-and-recheck at the end: a single assertion right after the scroll
   * passes even while the header is oscillating.
   */
  test("the header sheds its nav row scrolling down, brings it back scrolling up", async ({
    page,
  }) => {
    await signUp(page, "programs-compact");
    await page.goto("/library");

    const nav = page.getByRole("navigation", { name: "Primary" });
    const header = page.getByRole("banner");
    await expect(nav).toBeVisible();

    /*
     * The property that matters is that the page comes to rest: collapsing the
     * nav row must not move the document underneath it.
     *
     * It is asserted as "does scrolling stop" rather than "is the header in
     * state X" because of what the regression actually looked like. While the
     * header was in flow, collapsing it removed 48px from above the viewport,
     * scroll anchoring compensated by the same 48px, that read as scrolling up,
     * the row came back — and the position alternated between 900 and 852
     * forever. Reproduced here before this was written, to be sure the check
     * still catches it.
     *
     * Asserting the header's own class instead is what made the first version
     * of this test fail on CI: it re-checked a timing-sensitive state the run
     * had already moved past, and waiting for the page to settle first merely
     * hid the oscillation behind the wait.
     */
    const restsWithin = (frames: number) =>
      page.evaluate(async (limit) => {
        const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        let previous = Number.NaN;
        let still = 0;
        for (let elapsed = 0; elapsed < limit; elapsed++) {
          await frame();
          if (window.scrollY === previous) {
            still += 1;
            if (still >= 8) return true;
          } else {
            still = 0;
            previous = window.scrollY;
          }
        }
        return false;
      }, frames);

    await page.mouse.wheel(0, 900);
    expect(await restsWithin(120)).toBe(true);
    await expect(nav).toBeHidden();
    // Still pinned, just shorter.
    expect((await header.boundingBox())?.y).toBe(0);

    await page.mouse.wheel(0, -300);
    expect(await restsWithin(120)).toBe(true);
    await expect(nav).toBeVisible();
  });

  test("creating a program opens the full page, not a dialog", async ({ page }) => {
    await signUp(page, "programs-mobile");
    await page.goto("/programs");

    await page.getByTestId("create-program").click();

    // Same editor, framed as a page — a dialog would cram the whole builder
    // into a keyhole on this width.
    await expect(page).toHaveURL(/\/programs\/[A-Za-z0-9_-]+$/);
    await expect(page.getByTestId("program-dialog")).toHaveCount(0);
    await expect(page.getByTestId("program-title")).toHaveText("New program");
    await page.getByTestId("add-exercise").click();
    await page.getByTestId("picker-search").fill("push");
    await page.getByTestId("picker-result").first().click();
    await expect(page.getByTestId("day-exercise")).toHaveCount(1);
  });
});

test("search filters saved programs and templates together", async ({ page }) => {
  await signUp(page, "programs-search");
  await page.goto("/programs");

  await page.getByTestId("create-program").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await page.getByTestId("rename-program").click();
  await page.getByTestId("program-name-input").fill("monday");
  await page.getByTestId("save-program-name").click();
  await expect(page.getByTestId("program-title")).toHaveText("monday");
  await page.getByTestId("close-program-dialog").click();

  // "leg" matches only the Leg Day template — the saved program hides.
  await page.getByTestId("program-search").fill("leg");
  await expect(page.getByTestId("program-card")).toHaveCount(0);
  await expect(page.getByTestId("template-card")).toHaveCount(1);
  await expect(page.getByTestId("template-card")).toContainText("Leg Day");

  // "monday" matches only the saved program — the gallery hides entirely.
  await page.getByTestId("program-search").fill("monday");
  await expect(page.getByTestId("program-card")).toHaveCount(1);
  await expect(page.getByTestId("template-card")).toHaveCount(0);

  // Nothing at all says so, rather than rendering an empty page silently.
  await page.getByTestId("program-search").fill("zzzzz");
  await expect(page.getByTestId("search-empty")).toBeVisible();
});

test("the detail page's add-to-program flow builds a new program", async ({ page }) => {
  // Signed out, the button routes through sign-in instead of failing.
  await page.goto("/library/0025");
  await page.getByTestId("add-to-program").click();
  await expect(page).toHaveURL(/\/sign-in\?redirect=/);

  await signUp(page, "add-from-detail");
  await page.goto("/library/0025");
  await page.getByTestId("add-to-program").click();
  await expect(page.getByTestId("add-to-program-dialog")).toBeVisible();

  await page.getByTestId("add-to-new-program").click();
  await expect(page.getByTestId("add-to-program-done")).toBeVisible();
  await page.getByTestId("open-added-program").click();

  // The copy is a real program holding the exercise at the 4×10 default.
  await expect(page.getByTestId("program-title")).toHaveText("New program");
  await expect(page.getByTestId("day-exercise")).toHaveCount(1);
  await expect(page.getByTestId("day-exercise")).toContainText("bench press");
  await expect(page.getByTestId("entry-weight")).toHaveValue("20");
});
