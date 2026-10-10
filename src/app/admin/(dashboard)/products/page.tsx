import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapCategoryRow, mapProductRow, type CategoryRow, type ProductRow } from "@/lib/supabase/mappers";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";
import { getProductImageUrl } from "@/lib/image-url";

export const metadata: Metadata = {
  title: "Products",
};

export default async function AdminProductsPage() {
  const supabase = getSupabaseAdmin();

  const [{ data: productRows }, { data: categoryRows }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, description, price, image_path, category_id, is_available, is_active, is_featured, display_order, stock_quantity",
      )
      .order("display_order", { ascending: true }),
    supabase.from("categories").select("id, name, slug, description, display_order, is_active"),
  ]);

  const products = (productRows ?? []).map((row) => mapProductRow(row as ProductRow));
  const categories = (categoryRows ?? []).map((row) => mapCategoryRow(row as CategoryRow));
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

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

      {products.length === 0 ? (
        <EmptyState
          icon="🍱"
          title="No products yet"
          description="Add your first menu item to get started."
          action={
            <Link href="/admin/products/new">
              <Button>Add Product</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Price</th>
                <th className="px-4 py-2 font-medium">Stock</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => (
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
      )}
    </div>
  );
}
