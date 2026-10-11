import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_QUANTITY_PER_ITEM, parseQuantityInput, resolveQuantityInput } from "./quantity-input.ts";

test("parseQuantityInput accepts plain positive integers, including multi-digit ones", () => {
  assert.equal(parseQuantityInput("2"), 2);
  assert.equal(parseQuantityInput("25"), 25);
  assert.equal(parseQuantityInput("100"), 100);
  assert.equal(parseQuantityInput("1000"), 1000);
});

test("parseQuantityInput trims surrounding whitespace", () => {
  assert.equal(parseQuantityInput("  42  "), 42);
});

test("parseQuantityInput rejects empty/whitespace-only input", () => {
  assert.equal(parseQuantityInput(""), null);
  assert.equal(parseQuantityInput("   "), null);
});

test("parseQuantityInput rejects decimals", () => {
  assert.equal(parseQuantityInput("2.5"), null);
  assert.equal(parseQuantityInput("10."), null);
});

test("parseQuantityInput rejects negative numbers", () => {
  assert.equal(parseQuantityInput("-5"), null);
});

test("parseQuantityInput rejects non-numeric characters", () => {
  assert.equal(parseQuantityInput("abc"), null);
  assert.equal(parseQuantityInput("12abc"), null);
  assert.equal(parseQuantityInput("1e5"), null);
  assert.equal(parseQuantityInput("NaN"), null);
  assert.equal(parseQuantityInput("Infinity"), null);
});

test("parseQuantityInput rejects a value beyond Number.MAX_SAFE_INTEGER (overflow guard)", () => {
  assert.equal(parseQuantityInput("99999999999999999999999"), null);
});

test("resolveQuantityInput: invalid input (empty/decimal/negative/letters) is rejected, not silently fixed", () => {
  assert.deepEqual(resolveQuantityInput("", { stockLimit: 50 }), { kind: "invalid" });
  assert.deepEqual(resolveQuantityInput("abc", { stockLimit: 50 }), { kind: "invalid" });
  assert.deepEqual(resolveQuantityInput("-5", { stockLimit: 50 }), { kind: "invalid" });
  assert.deepEqual(resolveQuantityInput("2.5", { stockLimit: 50 }), { kind: "invalid" });
});

test("resolveQuantityInput: explicit zero resolves to remove", () => {
  assert.deepEqual(resolveQuantityInput("0", { stockLimit: 50 }), { kind: "remove" });
});

test("resolveQuantityInput: a quantity within stock and app limits is accepted as-is", () => {
  assert.deepEqual(resolveQuantityInput("25", { stockLimit: 50 }), { kind: "ok", quantity: 25 });
  assert.deepEqual(resolveQuantityInput("100", { stockLimit: 200 }), { kind: "ok", quantity: 100 });
});

test("resolveQuantityInput: exceeding stock clamps to the stock limit and reports why", () => {
  assert.deepEqual(resolveQuantityInput("1000", { stockLimit: 74 }), {
    kind: "clamped",
    quantity: 74,
    reason: "stock",
  });
});

test("resolveQuantityInput: exceeding the app-wide max (when stock itself is effectively unlimited) clamps to that instead", () => {
  assert.deepEqual(resolveQuantityInput(String(MAX_QUANTITY_PER_ITEM + 1), { stockLimit: 1_000_000 }), {
    kind: "clamped",
    quantity: MAX_QUANTITY_PER_ITEM,
    reason: "max",
  });
});

test("resolveQuantityInput: a custom appMaxLimit is respected over the default constant", () => {
  assert.deepEqual(resolveQuantityInput("500", { stockLimit: 1_000_000, appMaxLimit: 100 }), {
    kind: "clamped",
    quantity: 100,
    reason: "max",
  });
});

test("resolveQuantityInput: a zero stock limit (e.g. unavailable product) resolves any positive entry to remove", () => {
  assert.deepEqual(resolveQuantityInput("5", { stockLimit: 0 }), { kind: "remove" });
});

test("resolveQuantityInput: a stock limit equal to the entered quantity is accepted, not clamped", () => {
  assert.deepEqual(resolveQuantityInput("10", { stockLimit: 10 }), { kind: "ok", quantity: 10 });
});
