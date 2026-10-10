import { Suspense } from "react";
import type { Metadata } from "next";
import { MenuBrowser } from "./MenuBrowser";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { getSupabasePublic } from "@/lib/supabase/public";
import { mapCategoryRow, mapProductRow, type CategoryRow, type ProductRow } from "@/lib/supabase/mappers";

export const metadata: Metadata = {
  title: "Menu",
};

function MenuLoading() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

async function MenuData() {
  const supabase = getSupabasePublic();

  const [{ data: categoryRows }, { data: productRows }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, description, display_order, is_active")
      .order("display_order", { ascending: true }),
    supabase
      .from("products")
      .select(
        "id, name, description, price, image_path, category_id, is_available, is_active, is_featured, display_order, stock_quantity",
      )
      .order("display_order", { ascending: true }),
  ]);

  const categories = (categoryRows ?? []).map((row) => mapCategoryRow(row as CategoryRow));
  const products = (productRows ?? []).map((row) => mapProductRow(row as ProductRow));

  return <MenuBrowser products={products} categories={categories} />;
}

export default function MenuPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Menu</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Browse everything on offer today at Kumaran Mess.
      </p>
      <div className="mt-6">
        <Suspense fallback={<MenuLoading />}>
          <MenuData />
        </Suspense>
      </div>
    </div>
  );
}
