/**
 * Snap a computed weight to something that can actually be loaded.
 *
 * Rounding is DOWN by default and that default is load-bearing: a target of
 * 82.4 kg on 2.5 kg plates has to become 80, not 82.5, because rounding up
 * hands someone a weight they were never prescribed and, on a deload, partly
 * undoes the deload.
 *
 * The epsilon snap is not defensive noise. `7.5 / 2.5` is exactly 3 in
 * IEEE-754, but plenty of realistic pairs are not — `16.8 / 1.2` is
 * 13.999999999999998, and `Math.floor` of that silently removes a full
 * increment. Rounding the quotient to nine decimal places first is well inside
 * any real tolerance and well outside float noise.
 */
export function roundToIncrement(
  kg: number,
  incrementKg: number,
  mode: "down" | "nearest" = "down",
): number {
  if (!Number.isFinite(incrementKg) || incrementKg <= 0) {
    throw new RangeError(`increment must be a positive number, got ${incrementKg}`);
  }
  if (!Number.isFinite(kg) || kg <= 0) return 0;

  const quotient = Math.round((kg / incrementKg) * 1e9) / 1e9;
  const steps = mode === "down" ? Math.floor(quotient) : Math.round(quotient);
  // toFixed and back: 33 × 2.5 is exact, but 3 × 0.1 is 0.30000000000000004,
  // and that value would then be rendered to the user.
  return Number((steps * incrementKg).toFixed(6));
}
