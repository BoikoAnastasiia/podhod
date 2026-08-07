import { expect, test } from "@playwright/test";

/**
 * Every test that creates an account uses its own email, generated per test
 * run — the dev D1 database this suite runs against (playwright.config.ts
 * reuses the already-running dev server rather than a fresh one per run) is
 * not wiped between runs, and Better Auth rejects a duplicate email with a
 * 422 (see apps/api/test/auth.test.ts). A shared fixed address would make
 * a second run of this file fail on account creation, not on anything this
 * suite is meant to catch.
 */
function freshEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

const PASSWORD = "correct-horse-e2e-1";

test("sign-up creates an account and lands signed in", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(freshEmail("signup"));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByTestId("sign-up-submit").click();

  // Sign-up completes with autoSignIn (see apps/api/src/lib/auth.ts) and
  // sends the visitor home — assert both the URL and that the nav actually
  // carries a session, not just that navigation happened.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("nav-identity")).toBeVisible();
  await expect(page.getByTestId("sign-out")).toBeVisible();
});

test("sign-in with correct credentials succeeds", async ({ page }) => {
  const email = freshEmail("signin-ok");
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByTestId("sign-up-submit").click();
  await expect(page.getByTestId("nav-identity")).toBeVisible();

  await page.getByTestId("sign-out").click();
  await expect(page.getByTestId("sign-in-link")).toBeVisible();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("nav-identity")).toContainText(email);
});

test("sign-in with a wrong password shows an error and does not sign in", async ({ page }) => {
  const email = freshEmail("signin-bad");
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByTestId("sign-up-submit").click();
  await expect(page.getByTestId("nav-identity")).toBeVisible();
  await page.getByTestId("sign-out").click();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-right-password");
  await page.getByTestId("sign-in-submit").click();

  await expect(page.getByTestId("auth-error")).toBeVisible();
  // Still on /sign-in, and the nav never picks up a session.
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByTestId("sign-in-link")).toBeVisible();
});

test("sign-out returns to a signed-out state", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(freshEmail("signout"));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByTestId("sign-up-submit").click();
  await expect(page.getByTestId("nav-identity")).toBeVisible();

  await page.getByTestId("sign-out").click();

  await expect(page.getByTestId("sign-in-link")).toBeVisible();
  await expect(page.getByTestId("nav-identity")).not.toBeVisible();
});

test("/settings redirects when signed out and renders when signed in", async ({ page }) => {
  // Signed out: requireSession's beforeLoad guard (apps/web/src/lib/
  // requireSession.ts) must redirect to /sign-in before the page renders,
  // preserving where the visitor was headed.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fsettings/);

  // Create an account, then return to /settings directly — it must now
  // render rather than redirect.
  const email = freshEmail("settings");
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByTestId("sign-up-submit").click();
  await expect(page.getByTestId("nav-identity")).toBeVisible();

  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByTestId("settings-data")).toBeVisible();
});

test("the library remains reachable while signed out", async ({ page }) => {
  await page.goto("/library");
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();
  await expect(page.getByTestId("sign-in-link")).toBeVisible();
});

/**
 * Client-side validation (signInSchema/signUpSchema, packages/schema) is a
 * convenience only — apps/api/src/lib/authValidation.ts is the real gate
 * (see apps/api/test/auth.test.ts). What matters here is that a malformed
 * submission never even reaches the network: the `page.route` interception
 * below fails the test if it does, proving the rejection happened client-side.
 */
test("an invalid email is rejected client-side, before any network call", async ({ page }) => {
  // Scoped to the sign-up endpoint specifically, not all of /api/auth/** —
  // Nav's `authClient.useSession()` polls /api/auth/get-session in the
  // background on every navigation regardless of this test, which would
  // otherwise make this assertion fail for a reason unrelated to what it's
  // actually checking.
  let calledAuthApi = false;
  await page.route("**/api/auth/sign-up/email", async (route) => {
    calledAuthApi = true;
    await route.abort();
  });

  await page.goto("/sign-up");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByTestId("sign-up-submit").click();

  await expect(page.getByTestId("auth-error")).toContainText(
    "Enter a valid email address.",
  );
  await expect(page).toHaveURL(/\/sign-up$/);
  expect(calledAuthApi).toBe(false);
});

test("a too-short password is rejected client-side, before any network call", async ({
  page,
}) => {
  let calledAuthApi = false;
  await page.route("**/api/auth/sign-up/email", async (route) => {
    calledAuthApi = true;
    await route.abort();
  });

  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(freshEmail("shortpw"));
  await page.getByLabel("Password").fill("short1");
  await page.getByTestId("sign-up-submit").click();

  await expect(page.getByTestId("auth-error")).toContainText(
    "Password must be at least 8 characters.",
  );
  await expect(page).toHaveURL(/\/sign-up$/);
  expect(calledAuthApi).toBe(false);
});

/**
 * Server-side rejection of a request that skips apps/web's form entirely —
 * the actual gate. apps/api/test/auth.test.ts covers this same rule at the
 * unit level in more depth; this confirms it's wired into the real running
 * Worker this whole suite drives, not just the isolated test environment.
 */
test("the server rejects a malformed sign-up request that bypasses the client form", async ({
  page,
}) => {
  const res = await page.request.post("/api/auth/sign-up/email", {
    headers: { "content-type": "application/json" },
    data: { email: "not-an-email", password: "whatever1", name: "Nobody" },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error.code).toBe("bad_request");
});

/**
 * The dead-end error this phase fixes: Better Auth's implicit-linking
 * refusal (an "account not linked" redirect — see apps/api/src/lib/auth.ts)
 * used to surface as a raw, unexplained code. Driving the actual OAuth
 * handshake needs a live Google consent screen (out of reach here, same as
 * every other Google-flow test in this file) — what's covered
 * deterministically instead is that landing on this URL, exactly as Better
 * Auth's own redirect would leave the visitor, renders the actionable
 * message rather than the code itself.
 */
test("sign-in shows an actionable message after an account-linking dead end", async ({
  page,
}) => {
  await page.goto("/sign-in?error=account_not_linked");
  await expect(page.getByTestId("auth-error")).toContainText("Settings");
});

/**
 * Deliberately not e2e-ing the Google flow itself: that needs a real Google
 * account, a live consent screen, and credentials this suite doesn't have.
 * What's covered instead, deterministically: the button exists on both
 * screens, is reachable and activatable from the keyboard, and clicking it
 * starts a redirect toward Google's real authorisation endpoint carrying
 * one of the exact redirect_uri values Google has on file (see
 * apps/api/src/lib/auth.ts) — without this test ever letting the browser
 * actually reach accounts.google.com, so it stays deterministic and needs
 * no network access to Google. `client_id`'s presence is asserted, never
 * its value, per this task's own handling rules for these credentials.
 *
 * The redirect_uri's *host* isn't pinned to one value: `wrangler dev`
 * simulates the Worker's configured `routes` (podhod-workout.cc, per
 * wrangler.jsonc) rather than exposing the literal localhost:8787 the
 * dev server is actually reached on — confirmed by hitting the dev API
 * directly, and separately by driving the real browser flow all the way
 * to Google's consent screen, which showed the same substitution. Both
 * hosts this test accepts are registered with Google either way, so
 * Google itself never errors on it; what regresses if this ever breaks
 * is the *path*, which is what's actually pinned below.
 */
for (const [screen, path] of [
  ["sign-in", "/sign-in"],
  ["sign-up", "/sign-up"],
] as const) {
  test(`the Google button on ${screen} is reachable and starts a redirect to Google`, async ({
    page,
  }) => {
    await page.goto(path);
    const googleButton = page.getByTestId("google-signin");
    await expect(googleButton).toBeVisible();

    await googleButton.focus();
    await expect(googleButton).toBeFocused();

    let capturedUrl: string | undefined;
    await page.route("https://accounts.google.com/**", async (route) => {
      capturedUrl = route.request().url();
      await route.abort();
    });

    await googleButton.press("Enter");

    await expect.poll(() => capturedUrl, { timeout: 5000 }).toBeTruthy();
    const authUrl = new URL(capturedUrl!);
    expect(authUrl.hostname).toBe("accounts.google.com");
    expect(authUrl.pathname).toBe("/o/oauth2/v2/auth");
    expect(authUrl.searchParams.get("client_id")).toBeTruthy();
    expect(authUrl.searchParams.get("redirect_uri")).toMatch(
      /^https?:\/\/(localhost:8787|podhod-workout\.cc)\/api\/auth\/callback\/google$/,
    );
  });
}
