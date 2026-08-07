import { signInSchema, signUpSchema } from "@podhod/schema";
import { describe, expect, it } from "vitest";
import { buildI18n } from "../i18n/useI18n.js";
import { authValidationMessage } from "./authFormErrors.js";

const { t } = buildI18n("en", () => {});
const { t: tRu } = buildI18n("ru", () => {});

describe("authValidationMessage", () => {
  it("maps a malformed email to the invalid-email message", () => {
    const parsed = signInSchema.safeParse({ email: "not-an-email", password: "long-enough-1" });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("expected failure");
    expect(authValidationMessage(parsed.error, t)).toBe(t("auth.error.invalidEmail"));
  });

  it("maps a too-short password to the password-too-short message", () => {
    const parsed = signInSchema.safeParse({ email: "ok@example.com", password: "short1" });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("expected failure");
    expect(authValidationMessage(parsed.error, t)).toBe(t("auth.error.passwordTooShort"));
  });

  it("maps a too-long password to the password-too-long message", () => {
    const parsed = signInSchema.safeParse({
      email: "ok@example.com",
      password: "x".repeat(129),
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("expected failure");
    expect(authValidationMessage(parsed.error, t)).toBe(t("auth.error.passwordTooLong"));
  });

  it("produces a message in Russian too, not just the English fallback", () => {
    const parsed = signUpSchema.safeParse({ email: "nope", password: "long-enough-1" });
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("expected failure");
    expect(authValidationMessage(parsed.error, tRu)).toBe(tRu("auth.error.invalidEmail"));
    expect(authValidationMessage(parsed.error, tRu)).not.toBe(t("auth.error.invalidEmail"));
  });

  it("accepts a well-formed email and a password at the configured floor", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "exactly8" }).success).toBe(true);
  });
});
