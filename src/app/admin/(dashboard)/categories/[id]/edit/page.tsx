import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapCategoryRow, type CategoryRow } from "@/lib/supabase/mappers";
import { CategoryForm } from "@/components/admin/CategoryForm";

export const metadata: Metadata = {
  title: "Edit Category",
};

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description, display_order, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  const category = mapCategoryRow(data as CategoryRow);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Edit Category</h1>
      <CategoryForm category={category} />
    </div>
  );
}
