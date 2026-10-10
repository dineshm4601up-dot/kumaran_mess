import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { getCustomerSession } from "@/lib/customer-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapOrderListRow, type OrderListRow } from "@/lib/supabase/mappers";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = {
  title: "My Orders",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function OrdersPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/login?next=/orders");
  }

  // Scoped explicitly to this customer's id from the custom session —
  // using the service-role client here (not RLS) because customers don't
  // hold a real Supabase session (see the Phase 3 architecture notes).
  // This explicit scoping is the actual security boundary for this
  // query; Phase 2's RLS remains a backstop for any other access path.
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, status, total, created_at")
    .eq("customer_id", session.customerId)
    .order("created_at", { ascending: false });

  const orders = (data ?? []).map((row) => mapOrderListRow(row as OrderListRow));

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
      <div className="mt-6">
        {orders.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors hover:border-primary"
                >
                  <div>
                    <p className="font-medium text-foreground">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{formatCurrency(order.total)}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="📦"
            title="No orders yet"
            description="Place an order from the menu to see its status here."
            action={
              <Link href="/menu">
                <Button>Browse Menu</Button>
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
