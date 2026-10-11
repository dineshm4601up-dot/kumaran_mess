import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getAdminProducts } from "@/lib/admin-products";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapCategoryRow, type CategoryRow } from "@/lib/supabase/mappers";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SortableHeader } from "@/components/admin/SortableHeader";
import { formatCurrency } from "@/lib/format";
import { getProductImageUrl } from "@/lib/image-url";
import {
  DEFAULT_SORT_DIRECTION,
  isProductSortColumn,
  isSortDirection,
  sortProducts,
  type ProductSortColumn,
  type SortDirection,
} from "@/lib/product-sort";

export const metadata: Metadata = {
  title: "Products",
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  const { q, sort, dir } = await searchParams;
  const query = q?.trim() ? q.trim() : null;
  const sortColumn = isProductSortColumn(sort) ? sort : null;
  const sortDirection = isSortDirection(dir) ? dir : DEFAULT_SORT_DIRECTION;

  const supabase = getSupabaseAdmin();
  const [products, { data: categoryRows }] = await Promise.all([
    getAdminProducts(query),
    supabase.from("categories").select("id, name, slug, description, display_order, is_active"),
  ]);

  const categories = (categoryRows ?? []).map((row) => mapCategoryRow(row as CategoryRow));
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  // Sorting is applied here, after fetching every matching (searched)
  // product and before rendering either the table or the mobile cards —
  // there is no pagination on this page, so this already covers "all
  // matching products", not just a visible page (requirement: "sorting
  // should apply to all matching products... when pagination exists").
  const sortedProducts = sortProducts(products, categoryNameById, sortColumn, sortDirection);

  function buildSortHref(column: ProductSortColumn, direction: SortDirection): string {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("sort", column);
    params.set("dir", direction);
    return `/admin/products?${params.toString()}`;
  }

  const clearSearchHref = sortColumn
    ? `/admin/products?sort=${sortColumn}&dir=${sortDirection}`
    : "/admin/products";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Changes here appear on the public menu immediately.
          </p>
        </div>
        <Link href="/admin/products/new">
          <Button>+ Add Product</Button>
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2">
        {sortColumn && <input type="hidden" name="sort" value={sortColumn} />}
        {sortColumn && <input type="hidden" name="dir" value={sortDirection} />}
        <input
          type="search"
          name="q"
          defaultValue={query ?? ""}
          placeholder="Search by name or description (Tamil or English)..."
          aria-label="Search products"
          className="w-full max-w-sm rounded-[var(--radius-control)] border border-border bg-surface px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-2 focus:outline-offset-1 focus:outline-primary"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {query && (
          <Link href={clearSearchHref}>
            <Button type="button" variant="ghost">
              Clear search
            </Button>
          </Link>
        )}
      </form>

      {/* The sortable column headings below only exist in the desktop
          table (md:block) — the mobile layout is cards with no column
          headings at all (Phase 11), so phones need an equivalent
          control to actually reach sorting (requirement: "keep the
          table usable on mobile"). Plain GET form, no client JS. */}
      <form method="get" className="flex flex-wrap items-end gap-2 md:hidden">
        {query && <input type="hidden" name="q" value={query} />}
        <div className="flex flex-col gap-1">
          <label htmlFor="mobile-sort-column" className="text-xs font-medium text-muted-foreground">
            Sort by
          </label>
          <select
            id="mobile-sort-column"
            name="sort"
            defaultValue={sortColumn ?? ""}
            className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-primary"
          >
            <option value="">Default order</option>
            <option value="name">Product</option>
            <option value="category">Category</option>
            <option value="price">Price</option>
            <option value="stock">Stock</option>
            <option value="status">Status</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="mobile-sort-direction" className="text-xs font-medium text-muted-foreground">
            Direction
          </label>
          <select
            id="mobile-sort-direction"
            name="dir"
            defaultValue={sortDirection}
            className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-primary"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      {sortedProducts.length === 0 ? (
        <EmptyState
          icon="🍱"
          title={query ? "No matching products" : "No products yet"}
          description={query ? "Try a different search term." : "Add your first menu item to get started."}
          action={
            query ? (
              <Link href={clearSearchHref}>
                <Button variant="outline">Clear search</Button>
              </Link>
            ) : (
              <Link href="/admin/products/new">
                <Button>Add Product</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <SortableHeader
                    column="name"
                    label="Product"
                    activeColumn={sortColumn}
                    activeDirection={sortDirection}
                    buildHref={buildSortHref}
                  />
                  <SortableHeader
                    column="category"
                    label="Category"
                    activeColumn={sortColumn}
                    activeDirection={sortDirection}
                    buildHref={buildSortHref}
                  />
                  <SortableHeader
                    column="price"
                    label="Price"
                    activeColumn={sortColumn}
                    activeDirection={sortDirection}
                    buildHref={buildSortHref}
                  />
                  <SortableHeader
                    column="stock"
                    label="Stock"
                    activeColumn={sortColumn}
                    activeDirection={sortDirection}
                    buildHref={buildSortHref}
                  />
                  <SortableHeader
                    column="status"
                    label="Status"
                    activeColumn={sortColumn}
                    activeDirection={sortDirection}
                    buildHref={buildSortHref}
                  />
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="flex items-center gap-3 px-4 py-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-surface-muted">
                        <Image
                          src={getProductImageUrl(product.imagePath)}
                          alt={product.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <span className="font-medium text-foreground">
                        {product.name}
                        {product.isFeatured && <span className="ml-1" title="Featured">⭐</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {categoryNameById.get(product.categoryId) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground">{formatCurrency(product.price)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{product.stock}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={product.isActive ? "neutral" : "danger"}>
                          {product.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge tone={product.isAvailable ? "success" : "warning"}>
                          {product.isAvailable ? "Available" : "Unavailable"}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/products/${product.id}/edit`}>
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col divide-y divide-border md:hidden">
            {sortedProducts.map((product) => (
              <li key={product.id} className="flex items-center gap-3 p-4">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-surface-muted">
                  <Image
                    src={getProductImageUrl(product.imagePath)}
                    alt={product.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {product.name}
                    {product.isFeatured && <span className="ml-1" title="Featured">⭐</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {categoryNameById.get(product.categoryId) ?? "—"} &middot; {formatCurrency(product.price)} &middot;{" "}
                    Stock {product.stock}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge tone={product.isActive ? "neutral" : "danger"}>
                      {product.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge tone={product.isAvailable ? "success" : "warning"}>
                      {product.isAvailable ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                </div>
                <Link href={`/admin/products/${product.id}/edit`} className="shrink-0">
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
