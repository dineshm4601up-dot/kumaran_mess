import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapCategoryRow, type CategoryRow } from "@/lib/supabase/mappers";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Categories",
};

export default async function AdminCategoriesPage() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description, display_order, is_active")
    .order("display_order", { ascending: true });

  const categories = (data ?? []).map((row) => mapCategoryRow(row as CategoryRow));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only active categories show up on the public menu.
          </p>
        </div>
        <Link href="/admin/categories/new">
          <Button>+ Add Category</Button>
        </Link>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title="No categories yet"
          description="Create one to start building the menu."
          action={
            <Link href="/admin/categories/new">
              <Button>Add Category</Button>
            </Link>
          }
        />
      ) : (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Slug</th>
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{category.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{category.slug}</td>
                    <td className="px-4 py-3 text-muted-foreground">{category.displayOrder}</td>
                    <td className="px-4 py-3">
                      <Badge tone={category.isActive ? "success" : "neutral"}>
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/categories/${category.id}/edit`}>
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
            {categories.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{category.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {category.slug} &middot; Order {category.displayOrder}
                  </p>
                  <div className="mt-1.5">
                    <Badge tone={category.isActive ? "success" : "neutral"}>
                      {category.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <Link href={`/admin/categories/${category.id}/edit`} className="shrink-0">
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
