// Inline admin-product-table sorting (Task 3). Pure and framework-free
// (plain data in, plain data out) so it can be unit-tested directly,
// the same approach as product-search.ts.

export const PRODUCT_SORT_COLUMNS = ["name", "category", "price", "stock", "status"] as const;
export type ProductSortColumn = (typeof PRODUCT_SORT_COLUMNS)[number];
export type SortDirection = "asc" | "desc";

export function isProductSortColumn(value: unknown): value is ProductSortColumn {
  return PRODUCT_SORT_COLUMNS.includes(value as ProductSortColumn);
}

export function isSortDirection(value: unknown): value is SortDirection {
  return value === "asc" || value === "desc";
}

// Clicking a different column always starts ascending — one predictable
// rule rather than a different default per column (requirement: "a
// predictable default direction").
export const DEFAULT_SORT_DIRECTION: SortDirection = "asc";

export type SortableProduct = {
  name: string;
  price: number;
  stock: number;
  categoryId: string;
  isActive: boolean;
  isAvailable: boolean;
};

// "Logical status order" (requirement, "if practical"): healthiest
// first — active & available, then active-but-unavailable, then
// inactive (regardless of availability, since an inactive product is
// off the menu either way). Lower rank sorts first in ascending order.
export function statusRank(product: { isActive: boolean; isAvailable: boolean }): number {
  if (!product.isActive) return 2;
  return product.isAvailable ? 0 : 1;
}

function compareValues(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") {
    // Defensive, not reachable with this schema's `stock_quantity integer
    // not null` / `price numeric not null` constraints (checked against
    // the actual migration before writing this) — NaN never legitimately
    // occurs, but sorts last rather than corrupting the whole order if it
    // ever somehow did.
    if (Number.isNaN(a)) return Number.isNaN(b) ? 0 : 1;
    if (Number.isNaN(b)) return -1;
    return a - b;
  }
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });
}

function compareByColumn<T extends SortableProduct>(
  a: T,
  b: T,
  categoryNameById: Map<string, string>,
  column: ProductSortColumn,
): number {
  switch (column) {
    case "name":
      return compareValues(a.name, b.name);
    case "price":
      return compareValues(a.price, b.price);
    case "stock":
      return compareValues(a.stock, b.stock);
    case "category":
      return compareValues(categoryNameById.get(a.categoryId) ?? "", categoryNameById.get(b.categoryId) ?? "");
    case "status":
      return compareValues(statusRank(a), statusRank(b));
    default:
      return 0;
  }
}

// Stable regardless of JS engine — ties keep their original relative
// order via an explicit index tie-break, rather than relying on
// `Array.prototype.sort`'s spec-guaranteed-since-ES2019 stability alone
// (requirement: "keep sorting stable when values are equal").
export function sortProducts<T extends SortableProduct>(
  products: T[],
  categoryNameById: Map<string, string>,
  column: ProductSortColumn | null,
  direction: SortDirection,
): T[] {
  if (!column) return products;

  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const cmp = compareByColumn(a.product, b.product, categoryNameById, column);
      if (cmp !== 0) return direction === "asc" ? cmp : -cmp;
      return a.index - b.index;
    })
    .map((entry) => entry.product);
}
