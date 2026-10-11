import { formatCurrency } from "@/lib/format";
import type { ProductWiseReportRow } from "@/types";

export function ProductWiseReport({ rows }: { rows: ProductWiseReportRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No items sold in this range.</p>;
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 text-right font-medium">Quantity sold</th>
              <th className="px-4 py-2 text-right font-medium">Orders</th>
              <th className="px-4 py-2 text-right font-medium">Total sales</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.productName} className="hover:bg-surface-muted">
                <td className="px-4 py-3 font-medium text-foreground">{row.productName}</td>
                <td className="px-4 py-3 text-right text-foreground">{row.quantitySold}</td>
                <td className="px-4 py-3 text-right text-foreground">{row.orderCount}</td>
                <td className="px-4 py-3 text-right text-foreground">{formatCurrency(row.totalSales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={row.productName} className="p-4">
            <p className="font-medium text-foreground">{row.productName}</p>
            <p className="text-sm text-muted-foreground">
              {row.quantitySold} sold across {row.orderCount} order{row.orderCount === 1 ? "" : "s"}
            </p>
            <p className="text-sm font-medium text-foreground">{formatCurrency(row.totalSales)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
