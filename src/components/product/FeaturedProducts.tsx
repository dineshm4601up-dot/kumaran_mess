"use client";

import { ProductCard } from "@/components/product/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCart } from "@/lib/cart-context";
import type { Product } from "@/types";

export function FeaturedProducts({ products }: { products: Product[] }) {
  const { addItem } = useCart();

  if (products.length === 0) {
    return <EmptyState icon="⭐" title="No featured items yet" description="Check the full menu instead." />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAddToCart={addItem} />
      ))}
    </div>
  );
}
