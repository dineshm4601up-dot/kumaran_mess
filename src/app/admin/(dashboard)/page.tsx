import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapAdminOrderSearchRow, mapDashboardStatsRow, type AdminOrderSearchRow, type DashboardStatsRow } from "@/lib/supabase/mappers";
import { StatCard } from "@/components/admin/StatCard";
import { OrderStatusBadge, Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function AdminDashboardPage() {
  const supabase = getSupabaseAdmin();

  const [{ data: statsRow, error: statsError }, { data: recentRows, error: ordersError }] = await Promise.all([
    supabase.rpc("admin_dashboard_stats").single(),
    supabase.rpc("admin_search_orders", { p_query: null }),
  ]);

  if (statsError) console.error("admin_dashboard_stats:", statsError);
  if (ordersError) console.error("admin_search_orders:", ordersError);

  const stats = statsRow
    ? mapDashboardStatsRow(statsRow as DashboardStatsRow)
    : { todaysOrderCount: 0, todaysSales: 0, activeOrderCount: 0, deliveredTodayCount: 0, cancelledTodayCount: 0 };

  const recentOrders = ((recentRows ?? []) as AdminOrderSearchRow[]).slice(0, 10).map(mapAdminOrderSearchRow);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          &ldquo;Today&rdquo; is the store&rsquo;s own day (Asia/Kolkata), not UTC.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Today's Orders" value={String(stats.todaysOrderCount)} icon="📦" hint="Placed today, any status" />
        <StatCard label="Today's Sales" value={formatCurrency(stats.todaysSales)} icon="💰" hint="Placed today, excluding cancelled" />
        <StatCard label="Pending & Active" value={String(stats.activeOrderCount)} icon="⏳" hint="Not yet delivered or cancelled" />
        <StatCard label="Delivered Today" value={String(stats.deliveredTodayCount)} icon="✅" />
        <StatCard label="Cancelled Today" value={String(stats.cancelledTodayCount)} icon="🚫" />
      </div>

      <div className="rounded-[var(--radius-card)] border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
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
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{order.customerName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(order.createdAt)}</td>
                  <td className="px-4 py-3 text-foreground">{formatCurrency(order.total)}</td>
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
      </div>
    </div>
  );
}
