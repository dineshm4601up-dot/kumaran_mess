import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FeaturedProducts } from "@/components/product/FeaturedProducts";
import { getSupabasePublic } from "@/lib/supabase/public";
import { mapCategoryRow, mapProductRow, type CategoryRow, type ProductRow } from "@/lib/supabase/mappers";

export default async function HomePage() {
  const supabase = getSupabasePublic();

  const [{ data: categoryRows }, { data: featuredRows }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, description, display_order, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("products")
      .select(
        "id, name, description, price, image_path, category_id, is_available, is_active, is_featured, display_order, stock_quantity",
      )
      .eq("is_featured", true)
      .order("display_order", { ascending: true })
      .limit(8),
  ]);

  const categories = (categoryRows ?? []).map((row) => mapCategoryRow(row as CategoryRow));
  const featuredProducts = (featuredRows ?? []).map((row) => mapProductRow(row as ProductRow));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] bg-gradient-to-br from-primary to-primary-hover px-6 py-10 text-primary-foreground sm:px-10 sm:py-14">
        <Badge tone="neutral">
          <span className="text-foreground">Open now &middot; 7:00 AM – 9:30 PM</span>
        </Badge>
        <h1 className="text-3xl font-bold sm:text-4xl">Kumaran Mess</h1>
        <p className="max-w-md text-primary-foreground/90">
          Home-style South Indian tiffin, meals and bakes — delivered to your door.
          Cash on delivery.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/menu">
            <Button size="lg" variant="secondary">
              View Menu
            </Button>
          </Link>
          <Link href="/orders">
            <Button size="lg" variant="outline" className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10">
              Track an Order
            </Button>
          </Link>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Categories</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/menu?category=${category.slug}`}
                className="flex items-center justify-center rounded-[var(--radius-card)] border border-border bg-surface px-4 py-6 text-center text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Popular right now</h2>
          <Link href="/menu" className="text-sm font-medium text-primary hover:underline">
            See full menu
          </Link>
        </div>
        <div className="mt-4">
          <FeaturedProducts products={featuredProducts} />
        </div>
      </section>
    </div>
  );
}
