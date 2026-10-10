// DEMO DATA ONLY.
//
// Categories/products are now real Supabase data as of Phase 4 (see
// src/lib/supabase/public.ts and the Menu/Home pages) — only the admin
// order list/dashboard (orders aren't wired up yet) still use static
// sample data here, clearly not persisted or fetched from a database.

import type { OrderSummary } from "@/types";

export const DEMO_ORDERS: OrderSummary[] = [
  {
    id: "ord-1",
    orderNumber: "KM-20261010-0147",
    customerName: "Arun Kumar",
    placedAt: "2026-10-10T08:12:00+05:30",
    total: 240,
    status: "preparing",
    paymentMethod: "cod",
  },
  {
    id: "ord-2",
    orderNumber: "KM-20261010-0146",
    customerName: "Priya Raman",
    placedAt: "2026-10-10T07:58:00+05:30",
    total: 150,
    status: "out_for_delivery",
    paymentMethod: "cod",
  },
  {
    id: "ord-3",
    orderNumber: "KM-20261010-0145",
    customerName: "Suresh Babu",
    placedAt: "2026-10-10T07:40:00+05:30",
    total: 90,
    status: "pending",
    paymentMethod: "cod",
  },
  {
    id: "ord-4",
    orderNumber: "KM-20261009-0210",
    customerName: "Lakshmi Narayanan",
    placedAt: "2026-10-09T19:05:00+05:30",
    total: 310,
    status: "delivered",
    paymentMethod: "cod",
  },
  {
    id: "ord-5",
    orderNumber: "KM-20261009-0198",
    customerName: "Mohan Das",
    placedAt: "2026-10-09T13:30:00+05:30",
    total: 60,
    status: "cancelled",
    paymentMethod: "cod",
  },
];
