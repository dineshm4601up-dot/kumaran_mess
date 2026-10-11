import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isProductSortColumn,
  isSortDirection,
  sortProducts,
  statusRank,
  type SortableProduct,
} from "./product-sort.ts";

function product(overrides: Partial<SortableProduct> & { name: string }): SortableProduct {
  return {
    price: 0,
    stock: 0,
    categoryId: "cat-a",
    isActive: true,
    isAvailable: true,
    ...overrides,
  };
}

const categoryNames = new Map([
  ["cat-a", "Tiffin"],
  ["cat-b", "Beverages"],
]);

test("sorts by name ascending/descending", () => {
  const products = [product({ name: "Dosa" }), product({ name: "Coffee" }), product({ name: "Idli" })];
  const asc = sortProducts(products, categoryNames, "name", "asc").map((p) => p.name);
  assert.deepEqual(asc, ["Coffee", "Dosa", "Idli"]);
  const desc = sortProducts(products, categoryNames, "name", "desc").map((p) => p.name);
  assert.deepEqual(desc, ["Idli", "Dosa", "Coffee"]);
});

test("sorts by price numerically, not as strings", () => {
  // String sort would put "9" before "10" — numeric sort must not.
  const products = [product({ name: "A", price: 100 }), product({ name: "B", price: 9 }), product({ name: "C", price: 20 })];
  const asc = sortProducts(products, categoryNames, "price", "asc").map((p) => p.price);
  assert.deepEqual(asc, [9, 20, 100]);
});

test("sorts by stock numerically in both directions", () => {
  const products = [product({ name: "A", stock: 5 }), product({ name: "B", stock: 50 }), product({ name: "C", stock: 0 })];
  const asc = sortProducts(products, categoryNames, "stock", "asc").map((p) => p.stock);
  assert.deepEqual(asc, [0, 5, 50]);
  const desc = sortProducts(products, categoryNames, "stock", "desc").map((p) => p.stock);
  assert.deepEqual(desc, [50, 5, 0]);
});

test("sorts by category name alphabetically, resolved via the id map", () => {
  const products = [
    product({ name: "A", categoryId: "cat-a" }), // Tiffin
    product({ name: "B", categoryId: "cat-b" }), // Beverages
  ];
  const asc = sortProducts(products, categoryNames, "category", "asc").map((p) => p.name);
  assert.deepEqual(asc, ["B", "A"]); // Beverages before Tiffin
});

test("sorts by status in logical order: active+available, active+unavailable, inactive", () => {
  const products = [
    product({ name: "Inactive", isActive: false, isAvailable: true }),
    product({ name: "ActiveAvailable", isActive: true, isAvailable: true }),
    product({ name: "ActiveUnavailable", isActive: true, isAvailable: false }),
  ];
  const asc = sortProducts(products, categoryNames, "status", "asc").map((p) => p.name);
  assert.deepEqual(asc, ["ActiveAvailable", "ActiveUnavailable", "Inactive"]);
});

test("statusRank: inactive always ranks last regardless of availability", () => {
  assert.equal(statusRank({ isActive: false, isAvailable: true }), 2);
  assert.equal(statusRank({ isActive: false, isAvailable: false }), 2);
  assert.equal(statusRank({ isActive: true, isAvailable: true }), 0);
  assert.equal(statusRank({ isActive: true, isAvailable: false }), 1);
});

test("ties keep their original relative order (stable sort)", () => {
  const products = [
    product({ name: "Z", price: 10 }),
    product({ name: "Y", price: 10 }),
    product({ name: "X", price: 10 }),
  ];
  const result = sortProducts(products, categoryNames, "price", "asc").map((p) => p.name);
  assert.deepEqual(result, ["Z", "Y", "X"]);
});

test("a null column leaves the original order untouched", () => {
  const products = [product({ name: "B" }), product({ name: "A" })];
  const result = sortProducts(products, categoryNames, null, "asc").map((p) => p.name);
  assert.deepEqual(result, ["B", "A"]);
});

test("isProductSortColumn / isSortDirection validate input", () => {
  assert.equal(isProductSortColumn("price"), true);
  assert.equal(isProductSortColumn("nonsense"), false);
  assert.equal(isProductSortColumn(undefined), false);
  assert.equal(isSortDirection("asc"), true);
  assert.equal(isSortDirection("desc"), true);
  assert.equal(isSortDirection("sideways"), false);
});
