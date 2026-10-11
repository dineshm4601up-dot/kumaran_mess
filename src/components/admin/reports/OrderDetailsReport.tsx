import Link from "next/link";
import { OrderStatusBadge, Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { OrderDetailsReportRow } from "@/types";

export function OrderDetailsReport({ rows }: { rows: OrderDetailsReportRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No orders in this range.</p>;
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Order #</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Items</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">COD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.orderId} className="hover:bg-surface-muted">
                <td className="px-4 py-3 font-medium text-foreground">
                  <Link href={`/admin/orders/${row.orderId}`} className="hover:underline">
                    {row.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.createdAt)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.customerName}
                  <span className="block text-xs">{row.customerPhone}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.itemsSummary ?? "—"}</td>
                <td className="px-4 py-3 text-right text-foreground">{formatCurrency(row.total)}</td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3">
                  <Badge tone={row.paymentStatus === "collected" ? "success" : "neutral"}>{row.paymentStatus}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={row.orderId} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/admin/orders/${row.orderId}`} className="font-medium text-foreground hover:underline">
                {row.orderNumber}
              </Link>
              <OrderStatusBadge status={row.status} />
            </div>
            <p className="text-sm text-muted-foreground">{formatDateTime(row.createdAt)}</p>
            <p className="text-sm text-muted-foreground">
              {row.customerName} &middot; {row.customerPhone}
            </p>
            <p className="mt-1 text-sm text-foreground">{row.itemsSummary ?? "—"}</p>
            <div className="mt-2 flex items-center justify-between">
              <Badge tone={row.paymentStatus === "collected" ? "success" : "neutral"}>{row.paymentStatus}</Badge>
              <span className="font-medium text-foreground">{formatCurrency(row.total)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
