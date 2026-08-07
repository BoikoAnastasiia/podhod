import { describe, expect, it } from "vitest";
import { buildI18n } from "../i18n/useI18n.js";
import { oauthErrorMessage } from "./oauthErrors.js";

const { t } = buildI18n("en", () => {});

describe("oauthErrorMessage", () => {
  it("returns null when there is no error code", () => {
    expect(oauthErrorMessage(undefined, t)).toBeNull();
  });

  it("maps the implicit-linking dead end to the actionable message", () => {
    expect(oauthErrorMessage("account_not_linked", t)).toBe(t("auth.error.accountNotLinked"));
  });

  it("maps the manual-link email mismatch code, apostrophe included", () => {
    expect(oauthErrorMessage("email_doesn't_match", t)).toBe(t("auth.error.linkEmailMismatch"));
  });

  it("maps the manual-link already-linked-elsewhere code", () => {
    expect(oauthErrorMessage("account_already_linked_to_different_user", t)).toBe(
      t("auth.error.linkAlreadyLinkedElsewhere"),
    );
  });

  it("falls back to the generic message for an unrecognised code", () => {
    expect(oauthErrorMessage("some_future_code", t)).toBe(t("auth.error.generic"));
  });
});
