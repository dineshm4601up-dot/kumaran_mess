import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapAdminOrderSearchRow, type AdminOrderSearchRow } from "@/lib/supabase/mappers";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Orders",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_search_orders", { p_query: q ?? null });

  if (error) {
    console.error("admin orders search:", error);
  }

  const orders = ((data ?? []) as AdminOrderSearchRow[]).map(mapAdminOrderSearchRow);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search by order number, customer name or phone.</p>
      </div>

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="KM-20261010-00001, Priya, 98765..."
          aria-label="Search orders"
          className="w-full max-w-sm rounded-[var(--radius-control)] border border-border bg-surface px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-2 focus:outline-offset-1 focus:outline-primary"
        />
      </form>

      {orders.length === 0 ? (
        <EmptyState icon="🧾" title={q ? "No matching orders" : "No orders yet"} />
      ) : (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface">
          <OrdersTable orders={orders} />
        </div>
      )}
    </div>
  );
}
