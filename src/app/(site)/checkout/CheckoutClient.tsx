"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { AddressForm } from "@/components/checkout/AddressForm";
import { formatCurrency } from "@/lib/format";
import { getSupabasePublic } from "@/lib/supabase/public";
import { mapProductRow, type ProductRow } from "@/lib/supabase/mappers";
import type { CustomerAddress, ShopSettings } from "@/types";

type ItemIssue = { productId: string; name: string; reason: string };

export function CheckoutClient({
  initialAddress,
  settings,
}: {
  initialAddress: CustomerAddress | null;
  settings: ShopSettings;
}) {
  const { lines, subtotal, removeItem, syncProduct, clear } = useCart();

  const [address, setAddress] = useState(initialAddress);
  const [isEditingAddress, setIsEditingAddress] = useState(!initialAddress);
  const [issues, setIssues] = useState<ItemIssue[]>([]);
  const [isRevalidating, setIsRevalidating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<{ id: string; orderNumber: string; total: number } | null>(
    null,
  );

  // Generated once per mount (lazy initializer) and stays stable across
  // re-renders — sent with every "place order" attempt from this page
  // load, so a double-click (or a retry after a slow/ambiguous response)
  // replays the same key and the server returns the one order already
  // created instead of making a second.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" ? crypto.randomUUID() : "",
  );

  const requireLocation =
    settings.serviceRadiusKm !== null && settings.baseLatitude !== null && settings.baseLongitude !== null;

  // Revalidate availability before checkout: re-fetch current product
  // data for everything in the cart and flag anything that's changed
  // since it was added — the server re-checks all of this again at
  // order placement regardless, this is just so the customer isn't
  // surprised at the last step.
  useEffect(() => {
    // Nothing to revalidate, and isRevalidating only gates the "Place
    // Order" button, which isn't rendered at all once the empty-cart
    // view takes over below — so there's nothing to set here.
    if (lines.length === 0) {
      return;
    }

    let cancelled = false;

    (async () => {
      setIsRevalidating(true);
      const supabase = getSupabasePublic();
      const ids = lines.map((line) => line.product.id);
      const { data } = await supabase
        .from("products")
        .select(
          "id, name, description, price, image_path, category_id, is_available, is_active, is_featured, display_order, stock_quantity",
        )
        .in("id", ids);

      if (cancelled) return;

      const freshById = new Map((data ?? []).map((row) => [row.id, mapProductRow(row as ProductRow)]));
      const nextIssues: ItemIssue[] = [];

      for (const line of lines) {
        const fresh = freshById.get(line.product.id);
        if (!fresh || !fresh.isActive) {
          nextIssues.push({ productId: line.product.id, name: line.product.name, reason: "no longer on the menu" });
          continue;
        }
        if (!fresh.isAvailable) {
          nextIssues.push({ productId: line.product.id, name: fresh.name, reason: "currently unavailable" });
        } else if (fresh.stock < line.quantity) {
          nextIssues.push({
            productId: line.product.id,
            name: fresh.name,
            reason: `only ${fresh.stock} left in stock`,
          });
        }
        syncProduct(fresh);
      }

      setIssues(nextIssues);
      setIsRevalidating(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.map((line) => line.product.id).join(","), lines.map((line) => line.quantity).join(",")]);

  const deliveryFee = settings.deliveryFee;
  const total = subtotal + deliveryFee;
  const belowMinimum = settings.minOrderAmount > 0 && subtotal < settings.minOrderAmount;
  const missingRequiredLocation = requireLocation && (!address || address.latitude === null);

  async function handlePlaceOrder() {
    if (!address) {
      setSubmitError("Add a delivery address first.");
      return;
    }
    if (issues.length > 0) {
      setSubmitError("Please resolve the items flagged below before placing your order.");
      return;
    }
    if (belowMinimum) {
      setSubmitError(`Minimum order amount is ${formatCurrency(settings.minOrderAmount)}.`);
      return;
    }
    if (missingRequiredLocation) {
      setSubmitError("This address needs a pinned location — edit it below to add one.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/checkout/place-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: address.id,
          items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
          idempotencyKey,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setSubmitError(data.message ?? "Something went wrong placing your order.");
        return;
      }

      clear();
      setPlacedOrder({ id: data.order.id, orderNumber: data.order.orderNumber, total: data.order.total });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (placedOrder) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <p className="text-4xl">🎉</p>
        <h1 className="mt-3 text-2xl font-bold text-foreground">Order placed!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your order number is <span className="font-semibold text-foreground">{placedOrder.orderNumber}</span>.
          Pay {formatCurrency(placedOrder.total)} by cash on delivery.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={`/orders/${placedOrder.id}/bill`}>
            <Button variant="outline">View Bill</Button>
          </Link>
          <Link href="/orders">
            <Button>Track Order</Button>
          </Link>
          <Link href="/menu">
            <Button variant="outline">Order More</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <EmptyState
          icon="🧾"
          title="Your cart is empty"
          description="Add items from the menu before checking out."
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
      <h1 className="text-2xl font-bold text-foreground">Checkout</h1>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {issues.length > 0 && (
            <InfoBanner tone="warning">
              <p className="font-medium">Some items in your cart need attention:</p>
              <ul className="mt-1 list-inside list-disc">
                {issues.map((issue) => (
                  <li key={issue.productId} className="flex items-center justify-between gap-2">
                    <span>
                      {issue.name} — {issue.reason}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(issue.productId)}
                      className="shrink-0 text-xs font-medium underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </InfoBanner>
          )}

          <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Delivery address</h2>
              {address && !isEditingAddress && (
                <button
                  type="button"
                  onClick={() => setIsEditingAddress(true)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Edit
                </button>
              )}
            </div>

            <div className="mt-3">
              {isEditingAddress || !address ? (
                <AddressForm
                  address={address ?? undefined}
                  requireLocation={requireLocation}
                  onCancel={address ? () => setIsEditingAddress(false) : undefined}
                  onSaved={(saved) => {
                    setAddress(saved);
                    setIsEditingAddress(false);
                  }}
                />
              ) : (
                <div className="text-sm text-foreground">
                  <p>{address.addressLine}</p>
                  {address.landmark && <p className="text-muted-foreground">Near {address.landmark}</p>}
                  {address.latitude !== null && address.longitude !== null ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pinned: {address.latitude.toFixed(6)}, {address.longitude.toFixed(6)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">No location pinned.</p>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-foreground">Payment</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cash on Delivery — pay when your order arrives. This is currently the only payment method
              supported.
            </p>
          </section>

          <Button
            size="lg"
            isLoading={isSubmitting || isRevalidating}
            fullWidth
            className="md:hidden"
            onClick={handlePlaceOrder}
          >
            Place Order (COD)
          </Button>

          {submitError && <InfoBanner tone="warning">{submitError}</InfoBanner>}
        </div>

        <aside className="h-fit rounded-[var(--radius-card)] border border-border bg-surface-muted p-4">
          <h2 className="text-sm font-semibold text-foreground">Order summary</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {lines.map(({ product, quantity }) => (
              <li key={product.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {product.name} &times; {quantity}
                </span>
                <span className="font-medium text-foreground">{formatCurrency(product.price * quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Delivery fee</span>
              <span className="text-foreground">{formatCurrency(deliveryFee)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
              <span className="font-medium text-foreground">Total</span>
              <PriceDisplay amount={total} />
            </div>
          </div>
          {settings.minOrderAmount > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Minimum order: {formatCurrency(settings.minOrderAmount)}
              {belowMinimum && <span className="text-danger"> — add more items to reach this.</span>}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Final total is calculated and confirmed on the server when you place your order.
          </p>
          <Button
            size="lg"
            isLoading={isSubmitting || isRevalidating}
            fullWidth
            className="mt-4 hidden md:flex"
            onClick={handlePlaceOrder}
          >
            Place Order (COD)
          </Button>
        </aside>
      </div>
    </div>
  );
}
