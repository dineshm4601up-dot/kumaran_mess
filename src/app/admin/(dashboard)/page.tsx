import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapAdminOrderSearchRow, mapDashboardStatsRow, type AdminOrderSearchRow, type DashboardStatsRow } from "@/lib/supabase/mappers";
import { StatCard } from "@/components/admin/StatCard";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { formatCurrency } from "@/lib/format";

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
        <StatCard
          label="Today's Sales"
          value={formatCurrency(stats.todaysSales)}
          icon="💰"
          hint="Order value placed today, excluding cancelled — not the same as COD actually collected"
        />
        <StatCard
          label="Pending & Active"
          value={String(stats.activeOrderCount)}
          icon="⏳"
          hint="Placed today, not yet delivered or cancelled"
        />
        <StatCard
          label="Delivered Today"
          value={String(stats.deliveredTodayCount)}
          icon="✅"
          hint="Became delivered today — may include orders placed earlier"
        />
        <StatCard
          label="Cancelled Today"
          value={String(stats.cancelledTodayCount)}
          icon="🚫"
          hint="Became cancelled today — may include orders placed earlier"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        These cards count different events (placed vs. delivered vs. cancelled), so they won&apos;t always
        add up to Today&apos;s Orders — that&apos;s expected, not an error.
      </p>

      <div className="rounded-[var(--radius-card)] border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Recent orders</h2>
          <Link href="/admin/orders" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <OrdersTable orders={recentOrders} />
      </div>
    </div>
  );
}
