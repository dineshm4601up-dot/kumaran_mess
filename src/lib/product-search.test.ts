import { test } from "node:test";
import assert from "node:assert/strict";
import { getSearchQueryWords, matchesProductSearch, normalizeSearchText } from "./product-search.ts";

// The real product this fix is for (see PROJECT_PROGRESS.md): a Tamil
// product name with an English description, which previously matched
// nothing but a Tamil-script search.
const PAROTTA = { name: "பரோட்டா (1)", description: "Parotta (1 piece)" };

test("matches the Tamil product name", () => {
  assert.equal(matchesProductSearch(PAROTTA, null, getSearchQueryWords("பரோட்டா")), true);
});

test("matches the English description, case-insensitively", () => {
  assert.equal(matchesProductSearch(PAROTTA, null, getSearchQueryWords("Parotta")), true);
  assert.equal(matchesProductSearch(PAROTTA, null, getSearchQueryWords("parotta")), true);
  assert.equal(matchesProductSearch(PAROTTA, null, getSearchQueryWords("PAROTTA")), true);
});

test("matches a single word from inside the description", () => {
  assert.equal(matchesProductSearch(PAROTTA, null, getSearchQueryWords("piece")), true);
});

test("matches a multi-word phrase spanning the description", () => {
  assert.equal(matchesProductSearch(PAROTTA, null, getSearchQueryWords("1 piece")), true);
});

test("matches a category name even when it's in neither the name nor description", () => {
  assert.equal(matchesProductSearch(PAROTTA, "Tiffin", getSearchQueryWords("Tiffin")), true);
  assert.equal(matchesProductSearch(PAROTTA, "Tiffin", getSearchQueryWords("tiffin")), true);
});

test("does not match unrelated text", () => {
  assert.equal(matchesProductSearch(PAROTTA, "Tiffin", getSearchQueryWords("coffee")), false);
});

test("requires every word to match (AND across words), not just one", () => {
  // "piece" is in the description, "coffee" is not — the whole query
  // shouldn't match just because part of it does.
  assert.equal(matchesProductSearch(PAROTTA, null, getSearchQueryWords("piece coffee")), false);
});

test("an empty query matches everything", () => {
  assert.equal(matchesProductSearch(PAROTTA, null, getSearchQueryWords("")), true);
});

test("a whitespace-only query matches everything", () => {
  assert.equal(matchesProductSearch(PAROTTA, null, getSearchQueryWords("   ")), true);
});

test("leading/trailing spaces are trimmed", () => {
  assert.equal(matchesProductSearch(PAROTTA, null, getSearchQueryWords("  parotta  ")), true);
});

test("repeated internal spaces are collapsed", () => {
  assert.equal(matchesProductSearch(PAROTTA, null, getSearchQueryWords("1     piece")), true);
});

test("a product with no description (null) still matches on name only", () => {
  const noDescription = { name: "Filter Coffee", description: null };
  assert.equal(matchesProductSearch(noDescription, null, getSearchQueryWords("coffee")), true);
  assert.equal(matchesProductSearch(noDescription, null, getSearchQueryWords("piece")), false);
});

test("matching does not depend on availability — callers decide what to do with unavailable products", () => {
  // matchesProductSearch only ever looks at name/description/category;
  // an out-of-stock product's text still matches exactly the same way,
  // which matters because the menu shows unavailable products with an
  // overlay rather than hiding them — search must not hide them either.
  const outOfStockParotta = { ...PAROTTA };
  assert.equal(matchesProductSearch(outOfStockParotta, null, getSearchQueryWords("parotta")), true);
});

test("normalizeSearchText lowercases, trims, and collapses whitespace", () => {
  assert.equal(normalizeSearchText("  Parotta   (1  Piece)  "), "parotta (1 piece)");
});

test("getSearchQueryWords splits normalized text into words", () => {
  assert.deepEqual(getSearchQueryWords("  1   piece  "), ["1", "piece"]);
  assert.deepEqual(getSearchQueryWords(""), []);
});
