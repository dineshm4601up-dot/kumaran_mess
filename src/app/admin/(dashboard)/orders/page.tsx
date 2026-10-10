import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapAdminOrderSearchRow, type AdminOrderSearchRow } from "@/lib/supabase/mappers";
import { OrderStatusBadge, Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/format";

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
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Order #</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Placed</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Payment</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => (
                <tr key={order.id} className="cursor-pointer hover:bg-surface-muted">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <Link href={`/admin/orders/${order.id}`} className="block">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <Link href={`/admin/orders/${order.id}`} className="block">
                      {order.customerName}
                      <span className="block text-xs">{order.customerPhone}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <Link href={`/admin/orders/${order.id}`} className="block">
                      {formatDateTime(order.createdAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    <Link href={`/admin/orders/${order.id}`} className="block">
                      {formatCurrency(order.total)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={order.paymentStatus === "collected" ? "success" : "neutral"}>
                      {order.paymentStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
