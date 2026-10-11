import Image from "next/image";
import type { Product } from "@/types";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getProductImageUrl } from "@/lib/image-url";

export function ProductCard({
  product,
  onAddToCart,
}: {
  product: Product;
  onAddToCart?: (product: Product) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3 transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-control)] bg-surface-muted">
        <Image
          src={getProductImageUrl(product.imagePath)}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, 240px"
          className="object-cover"
          unoptimized // product photos come from a small catalog; skipping Next's optimizer avoids needing remotePatterns config and optimization quota for a business this size
        />
        {!product.isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Badge tone="danger">Out of stock</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">{product.name}</h3>
        {product.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <PriceDisplay amount={product.price} size="sm" />
        <Button
          size="md"
          variant="primary"
          disabled={!product.isAvailable}
          onClick={() => onAddToCart?.(product)}
          aria-label={`Add ${product.name} to cart`}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
