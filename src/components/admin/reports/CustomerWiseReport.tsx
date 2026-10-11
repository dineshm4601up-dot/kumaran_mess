import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { CustomerWiseReportRow } from "@/types";

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export function CustomerWiseReport({ rows }: { rows: CustomerWiseReportRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No orders in this range.</p>;
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 text-right font-medium">Orders</th>
              <th className="px-4 py-2 text-right font-medium">Delivered</th>
              <th className="px-4 py-2 text-right font-medium">Cancelled</th>
              <th className="px-4 py-2 text-right font-medium">Delivered sales</th>
              <th className="px-4 py-2 text-right font-medium">Avg. order value</th>
              <th className="px-4 py-2 font-medium">Last order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.customerId} className="hover:bg-surface-muted">
                <td className="px-4 py-3 font-medium text-foreground">
                  <Link href={`/admin/customers/${row.customerId}`} className="hover:underline">
                    {row.customerName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.customerPhone}</td>
                <td className="px-4 py-3 text-right text-foreground">{row.orderCount}</td>
                <td className="px-4 py-3 text-right text-foreground">{row.deliveredCount}</td>
                <td className="px-4 py-3 text-right text-foreground">{row.cancelledCount}</td>
                <td className="px-4 py-3 text-right text-foreground">{formatCurrency(row.deliveredSales)}</td>
                <td className="px-4 py-3 text-right text-foreground">{formatCurrency(row.avgDeliveredOrderValue)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(row.lastOrderAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={row.customerId} className="p-4">
            <Link href={`/admin/customers/${row.customerId}`} className="font-medium text-foreground hover:underline">
              {row.customerName}
            </Link>
            <p className="text-sm text-muted-foreground">{row.customerPhone}</p>
            <p className="mt-1 text-sm text-foreground">
              {row.orderCount} orders ({row.deliveredCount} delivered, {row.cancelledCount} cancelled)
            </p>
            <p className="text-sm text-foreground">
              {formatCurrency(row.deliveredSales)} delivered &middot; avg {formatCurrency(row.avgDeliveredOrderValue)}
            </p>
            <p className="text-xs text-muted-foreground">Last order: {formatDate(row.lastOrderAt)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
