import { StatCard } from "@/components/admin/StatCard";
import { SalesTrendChart } from "@/components/admin/reports/SalesTrendChart";
import { formatCurrency } from "@/lib/format";
import type { ReportSummary, SalesTrendPoint } from "@/types";

export function MonthlySalesReport({
  summary,
  trend,
}: {
  summary: ReportSummary;
  trend: SalesTrendPoint[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total orders" value={String(summary.totalOrders)} icon="📦" />
        <StatCard label="Delivered orders" value={String(summary.deliveredOrders)} icon="✅" />
        <StatCard label="Cancelled orders" value={String(summary.cancelledOrders)} icon="🚫" />
        <StatCard label="Pending / processing" value={String(summary.pendingProcessingOrders)} icon="⏳" />
        <StatCard
          label="Delivered sales"
          value={formatCurrency(summary.deliveredSales)}
          icon="💰"
          hint="Delivered orders only — cancelled orders are never counted as sales."
        />
        <StatCard label="Total delivery charges" value={formatCurrency(summary.totalDeliveryCharges)} icon="🛵" />
        <StatCard
          label="COD collected"
          value={formatCurrency(summary.codCollected)}
          icon="💵"
          hint="Delivered AND marked collected — delivered alone doesn't mean paid."
        />
        <StatCard
          label="COD pending collection"
          value={formatCurrency(summary.codPending)}
          icon="🕓"
          hint="Delivered but not yet marked collected."
        />
        <StatCard label="Avg. delivered order value" value={formatCurrency(summary.avgDeliveredOrderValue)} icon="📈" />
      </div>

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Sales trend</h2>
        <div className="mt-3">
          <SalesTrendChart points={trend} />
        </div>
      </div>
    </div>
  );
}
