"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CategoryTabs } from "@/components/product/CategoryTabs";
import { ProductCard } from "@/components/product/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSearchQueryWords, matchesProductSearch } from "@/lib/product-search";
import type { Category, Product } from "@/types";

const ALL_CATEGORY_ID = "all";

export function MenuBrowser({ products, categories }: { products: Product[]; categories: Category[] }) {
  const searchParams = useSearchParams();
  const initialSlug = searchParams.get("category");
  const initialCategory = categories.find((category) => category.slug === initialSlug)?.id ?? ALL_CATEGORY_ID;

  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [query, setQuery] = useState("");

  const categoryTabs = useMemo(
    () => [{ id: ALL_CATEGORY_ID, name: "All", slug: "all", description: null, displayOrder: -1, isActive: true }, ...categories],
    [categories],
  );

  // Maps a product's category id to its name so search can match
  // against the category too (e.g. searching "Tiffin" finds everything
  // in that category), without needing the full category object.
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const queryWords = useMemo(() => getSearchQueryWords(query), [query]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === ALL_CATEGORY_ID || product.categoryId === activeCategory;
      if (!matchesCategory) return false;
      return matchesProductSearch(product, categoryNameById.get(product.categoryId) ?? null, queryWords);
    });
  }, [products, activeCategory, queryWords, categoryNameById]);

  if (products.length === 0) {
    return (
      <EmptyState
        icon="🍽️"
        title="Nothing on the menu yet"
        description="Check back soon — we're setting things up."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search for idli, dosa, coffee..."
        aria-label="Search products"
        className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-2 focus:outline-offset-1 focus:outline-primary"
      />

      <CategoryTabs
        categories={categoryTabs}
        activeId={activeCategory}
        onChange={setActiveCategory}
      />

      {filteredProducts.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No items found"
          description="Try a different search term or category."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
