// Customer menu search matching. Deliberately framework-agnostic (plain
// strings in, boolean out) so it can be unit-tested directly with
// node:test without pulling in a DOM/React testing dependency — see
// product-search.test.ts.
//
// Product names in this catalog are often Tamil (e.g. "பரோட்டா (1)")
// while the description carries the English equivalent ("Parotta (1
// piece)"). Matching only the name therefore misses almost every
// English search. This searches name + description + category name
// together, word-by-word, so a query can match any of the three
// fields independently (requirement: name OR description OR category).

export function normalizeSearchText(value: string): string {
  // .toLowerCase() case-folds Latin text and is a safe no-op on Tamil
  // script (and any other non-cased script) — there's no "case" to
  // fold, so nothing is altered or broken by applying it unconditionally.
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// Splits a raw search box value into normalized words, collapsing
// repeated whitespace and dropping leading/trailing space. An
// empty/whitespace-only query yields an empty array, which callers
// should treat as "match everything" (requirement: empty search shows
// the normal listing).
export function getSearchQueryWords(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized.length === 0 ? [] : normalized.split(" ");
}

// True if every word in queryWords appears as a substring somewhere in
// the product's name, description, or category name (checked against
// the combined, normalized text — not each field separately — so a
// query can match across fields, e.g. one word from the name and one
// from the description). Plain substring checks only (no regex), so
// there's no special-character/injection concern with user input.
export function matchesProductSearch(
  product: { name: string; description: string | null },
  categoryName: string | null,
  queryWords: string[],
): boolean {
  if (queryWords.length === 0) return true;

  const haystack = normalizeSearchText(
    [product.name, product.description ?? "", categoryName ?? ""].join(" "),
  );

  return queryWords.every((word) => haystack.includes(word));
}
