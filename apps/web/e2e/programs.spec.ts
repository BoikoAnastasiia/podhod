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
test("an exercise already in the program cannot be added again", async ({ page }) => {
  await signUp(page, "programs-dupe");
  await page.goto("/programs");

  await page.getByTestId("create-program").click();
  await expect(page.getByTestId("program-dialog")).toBeVisible();
  await page.getByTestId("add-exercise").click();
  await page.getByTestId("picker-search").fill("air bike");

  const picked = page.getByTestId("picker-result").first();
  await picked.click();
  await expect(page.getByTestId("day-exercise")).toHaveCount(1);

  // The row it came from now says so, and is no longer clickable.
  await expect(picked.getByTestId("picker-added")).toBeVisible();
  await expect(picked).toBeDisabled();

  // The server holds the same line, whatever the client believes.
  const status = await page.evaluate(async () => {
    const list = await (await fetch("/api/programs")).json();
    const program = list.programs.find((p: { name: string }) => p.name === "New program");
    const detail = await (await fetch(`/api/programs/${program.id}`)).json();
    const existing = detail.exercises[0].exerciseId;
    const res = await fetch(`/api/programs/${program.id}/exercises`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ exerciseId: existing, scheme: { kind: "fixed", sets: 4, reps: 10, weightKg: 20 } }),
    });
    return res.status;
  });
  expect(status).toBe(409);
  await expect(page.getByTestId("day-exercise")).toHaveCount(1);
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

    await page.mouse.wheel(0, 900);
    await expect(nav).toBeHidden();
    // Still pinned, just shorter.
    expect((await header.boundingBox())?.y).toBe(0);

    await page.mouse.wheel(0, -300);
    await expect(nav).toBeVisible();

    // And it stays put once the scrolling stops.
    const settled = await page.evaluate(async () => {
      const seen = new Set<string>();
      for (let frame = 0; frame < 30; frame++) {
        seen.add(String(document.querySelector("header")?.dataset.compact));
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return [...seen];
    });
    expect(settled).toEqual(["false"]);
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
