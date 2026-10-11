"use client";

import { useState } from "react";
import Image from "next/image";
import type { Product } from "@/types";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/lib/cart-context";
import { getProductImageUrl } from "@/lib/image-url";
import { resolveQuantityInput } from "@/lib/quantity-input";

// Compact +/- stepper for the product grid specifically — not the same
// component as cart/QuantityStepper.tsx (used on the full-width cart
// page), because this card's bottom row has to fit price + stepper side
// by side in as little as ~112px of content width at a 320px viewport
// (the menu grid is 2 columns below the `sm` breakpoint — confirmed by
// reading MenuBrowser.tsx/FeaturedProducts.tsx before building this).
// 44px buttons plus a cart-page-style gap literally do not fit there
// alongside the price; stacking the whole row at the same `sm:`
// breakpoint the grid itself uses (so price sits above a right-aligned
// stepper only on the narrowest screens) is what actually prevents
// overflow, which the task treats as a hard requirement ("prevent
// buttons from wrapping or overflowing") — ahead of the *preferred*
// (not required) ~44px touch target, which these buttons approach at
// 40px without tipping the layout over.
// stockLimit is the ceiling the typed value and the +/- buttons are
// both validated against: the product's real stock while it's
// available, or the quantity already in the cart while it isn't (which
// blocks any further increase — typed or clicked — while still letting
// the customer decrease/remove what they already have).
function ProductQuantityStepper({
  productName,
  quantity,
  stockLimit,
  onCommit,
  increaseDisabled,
}: {
  productName: string;
  quantity: number;
  stockLimit: number;
  onCommit: (nextQuantity: number) => void;
  increaseDisabled: boolean;
}) {
  // The input's own text, separate from the committed cart quantity —
  // this is what lets the field go briefly empty while the customer is
  // mid-edit without that being treated as "remove this item" the
  // instant they clear it (requirement 2: "allow temporary empty input
  // while editing"). Nothing here is written back to the shared cart
  // until commit() runs, on blur or Enter.
  const [draft, setDraft] = useState(() => String(quantity));
  const [lastSyncedQuantity, setLastSyncedQuantity] = useState(quantity);
  const [error, setError] = useState<string | null>(null);

  // The React-documented pattern for "reset derived state when a prop
  // changes" — adjusting state during render, not in a useEffect, so
  // there's no extra render/flicker and no react-hooks/set-state-in-effect
  // concern. quantity only ever changes here via this exact component's
  // own +/- clicks or a previous commit (both already settle the draft
  // themselves), so this mainly keeps the two in sync defensively.
  if (quantity !== lastSyncedQuantity) {
    setLastSyncedQuantity(quantity);
    setDraft(String(quantity));
  }

  function commit(rawValue: string) {
    const resolution = resolveQuantityInput(rawValue, { stockLimit });

    if (resolution.kind === "invalid") {
      // Empty, non-integer, negative, decimal, or otherwise unparsable
      // — revert to the last valid quantity rather than guessing at
      // what the customer meant (requirement: "do not silently truncate
      // invalid values").
      setDraft(String(quantity));
      setError(rawValue.trim() === "" ? null : "Enter a whole number.");
      return;
    }

    if (resolution.kind === "remove") {
      setError(null);
      onCommit(0);
      return;
    }

    if (resolution.kind === "clamped") {
      setDraft(String(resolution.quantity));
      setError(
        resolution.reason === "stock"
          ? `Only ${stockLimit} left in stock.`
          : `Maximum order quantity is ${resolution.quantity}.`,
      );
      onCommit(resolution.quantity);
      return;
    }

    setError(null);
    onCommit(resolution.quantity);
  }

  // Steps relative to whatever is currently in the *input* (`draft`),
  // not the last-committed `quantity` — deliberately. Clicking a button
  // blurs the input first (native browser behavior fires blur before
  // click), and that blur's own commit() runs from a closure holding
  // whatever `quantity` was at the start of *this* render; reading
  // `draft` instead sidesteps that entirely, since every keystroke
  // already re-renders with the latest draft before any click handler
  // could fire. Without this, typing "50" and immediately clicking "+"
  // could silently discard the typed value and step from the old
  // committed quantity instead.
  function step(delta: number) {
    const resolution = resolveQuantityInput(draft, { stockLimit });
    const base =
      resolution.kind === "ok" || resolution.kind === "clamped"
        ? resolution.quantity
        : resolution.kind === "remove"
          ? 0
          : quantity;
    commit(String(Math.max(0, base + delta)));
  }

  return (
    <div className="flex w-full flex-col items-end gap-1 sm:w-auto">
      <div className="inline-flex items-center rounded-full border border-border bg-surface">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={`Decrease quantity of ${productName}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-medium text-foreground hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          aria-label={`Quantity of ${productName}`}
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            setError(null);
            // Filtered as the customer types, same convention as every
            // other numeric field in this app (PIN/mobile inputs) — this
            // restricts keystrokes, it never changes the *committed*
            // cart quantity, which only ever happens in commit() below.
            setDraft(event.target.value.replace(/\D/g, ""));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          onBlur={(event) => commit(event.target.value)}
          className="h-10 w-12 shrink-0 border-x border-border bg-transparent text-center text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={increaseDisabled}
          aria-label={`Increase quantity of ${productName}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-medium text-foreground hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          +
        </button>
      </div>
      {error && (
        <p role="status" className="text-right text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  // Reads straight from the shared cart context — no per-card quantity
  // state of its own (requirement: "use the existing cart state
  // management rather than creating a separate quantity state for each
  // product card"), keyed by product.id, never by name, so the menu,
  // cart page, header badge, and checkout summary can never disagree
  // about which product a line refers to.
  const { lines, addItem, setQuantity } = useCart();
  const quantity = lines.find((line) => line.product.id === product.id)?.quantity ?? 0;

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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <PriceDisplay amount={product.price} size="sm" />
        {quantity > 0 ? (
          <ProductQuantityStepper
            productName={product.name}
            quantity={quantity}
            // The real stock count while the product is available —
            // typing or clicking past it clamps back down with a
            // message instead of silently accepting it. Once a product
            // goes unavailable (admin toggle, or a reload with fresher
            // data), the ceiling becomes whatever is already in the
            // cart: no further increase, typed or clicked, but
            // decreasing/removing what's already there always stays
            // possible. The "Out of stock" badge above is the "clear
            // message" for that specific case (requirement 4); the
            // stepper's own error text below it covers the stock-limit
            // case for an otherwise-available product.
            stockLimit={product.isAvailable ? product.stock : quantity}
            onCommit={(nextQuantity) => setQuantity(product.id, nextQuantity)}
            increaseDisabled={!product.isAvailable}
          />
        ) : (
          <Button
            size="md"
            variant="primary"
            disabled={!product.isAvailable}
            onClick={() => addItem(product)}
            aria-label={`Add ${product.name} to cart`}
          >
            Add
          </Button>
        )}
      </div>
    </div>
  );
}
