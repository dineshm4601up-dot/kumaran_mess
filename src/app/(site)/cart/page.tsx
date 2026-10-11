"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart-context";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/cart/QuantityStepper";
import { formatCurrency } from "@/lib/format";
import { getProductImageUrl } from "@/lib/image-url";

export default function CartPage() {
  const { lines, subtotal, setQuantity, removeItem } = useCart();

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          description="Add something tasty from the menu to get started."
          action={
            <Link href="/menu">
              <Button>Browse Menu</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Your Cart</h1>

      <ul className="mt-6 flex flex-col divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
        {lines.map(({ product, quantity }) => (
          <li key={product.id} className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap sm:gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-surface-muted">
              <Image
                src={getProductImageUrl(product.imagePath)}
                alt={product.name}
                fill
                sizes="64px"
                className="object-cover"
                unoptimized
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-semibold text-foreground">{product.name}</p>
              <PriceDisplay amount={product.price} size="sm" />
            </div>

            <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
              <QuantityStepper
                label={product.name}
                quantity={quantity}
                onIncrease={() => setQuantity(product.id, quantity + 1)}
                onDecrease={() => setQuantity(product.id, quantity - 1)}
              />

              <button
                type="button"
                onClick={() => removeItem(product.id)}
                aria-label={`Remove ${product.name} from cart`}
                className="rounded-[var(--radius-control)] text-sm text-muted-foreground hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface-muted p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Delivery charge and final total are calculated at checkout.
        </p>
      </div>

      <div className="mt-6 flex justify-end">
        <Link href="/checkout">
          <Button size="lg">Proceed to Checkout</Button>
        </Link>
      </div>
    </div>
  );
}
