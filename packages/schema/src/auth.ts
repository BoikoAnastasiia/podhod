import { z } from "zod";

/**
 * Mirrors `emailAndPassword.minPasswordLength` / `.maxPasswordLength` in
 * apps/api/src/lib/auth.ts, which imports these same constants rather than
 * hard-coding its own numbers — one source of truth instead of two figures
 * that could quietly drift apart. Better Auth's own unconfigured defaults
 * are 8 and 128 (confirmed against the installed 1.6.26 source,
 * context/create-context.mjs: `minPasswordLength: ... || 8`,
 * `maxPasswordLength: ... || 128`); this repo sets them explicitly in
 * auth.ts instead of relying on that default silently continuing to hold.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Format validation, not ownership verification. Zod can confirm a string
 * is *shaped* like an email address; only sending mail to it and getting a
 * response back proves someone actually controls it — and this app sends no
 * mail (Cloudflare Email Sending needs the Workers Paid plan, which this
 * project's owner declined; see phase-1b notes). Passing this schema means
 * "well-formed", never "verified" — nothing downstream should treat it as
 * the latter. Better Auth's own `emailVerified` column is the only honest
 * signal of verification this app has, and it stays false for every
 * email+password account for exactly this reason.
 */
const email = z.string().trim().min(1).email();

const password = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

/**
 * Used on both sides of the wire: apps/web's sign-in form parses with this
 * before ever calling authClient (immediate feedback, no round trip), and
 * apps/api revalidates the same shape server-side before handing the
 * request to Better Auth's own handler (see apps/api/src/lib/
 * authValidation.ts) — client-side validation is a convenience, never a
 * security boundary, so the server gate is the one that actually matters.
 */
export const signInSchema = z.object({ email, password });
export type SignInInput = z.infer<typeof signInSchema>;

/**
 * `name` is optional here even though Better Auth's sign-up endpoint
 * requires one: apps/web's sign-up form only collects email + password and
 * derives a default name from the email's local part at the call site (see
 * routes/sign-up.tsx) rather than this schema inventing one, so this schema
 * only asserts a shape *if* a name is present rather than mandating it.
 */
export const signUpSchema = z.object({
  email,
  password,
  name: z.string().trim().min(1).max(100).optional(),
});
export type SignUpInput = z.infer<typeof signUpSchema>;
