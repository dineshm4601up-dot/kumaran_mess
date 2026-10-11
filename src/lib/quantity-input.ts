// Pure validation/resolution logic for the editable quantity field on a
// product card — framework-free (plain strings/numbers in, a plain
// result out) so it's directly unit-testable, the same approach as
// product-search.ts/product-sort.ts.

// A hard ceiling regardless of stock (requirement: "if the shop has no
// stock limit for a product, support large quantities within a
// reasonable configured application limit") — guards against a typed
// value like "999999999" producing an absurd line total or overflowing
// anything downstream, independent of whatever a product's real stock
// happens to be. One named constant, not a magic number, so it's easy
// to find and change later if the real business limit differs.
export const MAX_QUANTITY_PER_ITEM = 9999;

// Accepts only a string of one or more digits — this single check is
// what rejects empty input, negative signs, decimal points, letters,
// and whitespace-only input all at once, rather than needing a separate
// rule for each (requirement: "reject non-integer quantities", "do not
// allow negative quantities, decimals, or invalid characters").
export function parseQuantityInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  // Number.isSafeInteger guards the "integer overflow" requirement — a
  // string of enough digits to exceed Number.MAX_SAFE_INTEGER is
  // rejected outright rather than silently becoming some other number.
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export type QuantityResolution =
  | { kind: "invalid" }
  | { kind: "remove" }
  | { kind: "clamped"; quantity: number; reason: "stock" | "max" }
  | { kind: "ok"; quantity: number };

// stockLimit is the caller's responsibility to compute correctly for
// the situation — e.g. the product's real stock count when it's
// available, or the *current* cart quantity (so no further increase is
// possible, but the existing amount is still accepted) when it's not.
// This function only ever compares against whatever limit it's given.
export function resolveQuantityInput(
  rawValue: string,
  limits: { stockLimit: number; appMaxLimit?: number },
): QuantityResolution {
  const parsed = parseQuantityInput(rawValue);
  if (parsed === null) return { kind: "invalid" };

  // Explicit zero is deliberately its own outcome, not folded into
  // "invalid" — it's a valid thing to type, and removing the item is
  // the same behavior the minus button already has at zero
  // (requirement: "apply the established remove-at-zero behaviour
  // consistently").
  if (parsed === 0) return { kind: "remove" };

  const appMaxLimit = limits.appMaxLimit ?? MAX_QUANTITY_PER_ITEM;
  const effectiveLimit = Math.min(limits.stockLimit, appMaxLimit);

  if (parsed > effectiveLimit) {
    const clamped = Math.max(0, effectiveLimit);
    if (clamped === 0) return { kind: "remove" };
    return { kind: "clamped", quantity: clamped, reason: limits.stockLimit <= appMaxLimit ? "stock" : "max" };
  }

  return { kind: "ok", quantity: parsed };
}
