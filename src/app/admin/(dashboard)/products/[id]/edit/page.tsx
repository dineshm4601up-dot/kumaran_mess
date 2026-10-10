import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapCategoryRow, mapProductRow, type CategoryRow, type ProductRow } from "@/lib/supabase/mappers";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata: Metadata = {
  title: "Edit Product",
};

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const [{ data: productRow }, { data: categoryRows }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, description, price, image_path, category_id, is_available, is_active, is_featured, display_order, stock_quantity",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id, name, slug, description, display_order, is_active")
      .order("display_order", { ascending: true }),
  ]);

  if (!productRow) {
    notFound();
  }

  const product = mapProductRow(productRow as ProductRow);
  const categories = (categoryRows ?? []).map((row) => mapCategoryRow(row as CategoryRow));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Edit Product</h1>
      <ProductForm product={product} categories={categories} />
    </div>
  );
}
