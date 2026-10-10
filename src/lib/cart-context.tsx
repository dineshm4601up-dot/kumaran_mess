"use client";

// Cart state lives in React context, persisted to localStorage so it
// survives navigation and page refreshes in the same browser (per-device
// only — there is no server-side cart table, by design: carts are a
// client-side convenience, and checkout always revalidates everything
// against the live database regardless of what's cached here).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "@/types";

export type CartLine = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  syncProduct: (product: Product) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "km-cart-v1";

function readStoredLines(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Starts empty to match server-rendered output exactly (no
  // localStorage during SSR); the stored cart is applied right after
  // mount in the effect below, which is the standard safe pattern for
  // browser-storage-backed state in a server-rendered app.
  const [lines, setLines] = useState<CartLine[]>([]);
  const hasHydrated = useRef(false);

  useEffect(() => {
    // One-time read of an external store (localStorage) right after
    // mount, intentionally not derivable/renderable any other way since
    // it isn't available during SSR — this is the standard hydration
    // pattern the lint rule's "sync external systems" guidance is
    // actually describing, not the anti-pattern it's meant to catch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines(readStoredLines());
    hasHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hasHydrated.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage can throw (quota, private mode, disabled) — losing cart
      // persistence is not worth failing the page over.
    }
  }, [lines]);

  const addItem = useCallback((product: Product) => {
    setLines((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setLines((prev) => prev.filter((line) => line.product.id !== productId));
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((prev) => {
      if (quantity <= 0) {
        return prev.filter((line) => line.product.id !== productId);
      }
      return prev.map((line) =>
        line.product.id === productId ? { ...line, quantity } : line,
      );
    });
  }, []);

  // Refreshes a line's cached product snapshot (price/availability/etc.)
  // with current data — used by checkout's pre-order revalidation so the
  // displayed subtotal matches what the server will actually charge.
  const syncProduct = useCallback((product: Product) => {
    setLines((prev) =>
      prev.map((line) => (line.product.id === product.id ? { ...line, product } : line)),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const itemCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines],
  );

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [lines],
  );

  const value = useMemo(
    () => ({ lines, itemCount, subtotal, addItem, removeItem, setQuantity, syncProduct, clear }),
    [lines, itemCount, subtotal, addItem, removeItem, setQuantity, syncProduct, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
