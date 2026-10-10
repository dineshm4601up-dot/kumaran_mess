import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapCategoryRow, type CategoryRow } from "@/lib/supabase/mappers";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata: Metadata = {
  title: "Add Product",
};

export default async function NewProductPage() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description, display_order, is_active")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const categories = (data ?? []).map((row) => mapCategoryRow(row as CategoryRow));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Add Product</h1>
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Create a category first before adding products.
        </p>
      ) : (
        <ProductForm categories={categories} />
      )}
    </div>
  );
}
