import { formatCurrency } from "@/lib/format";
import type { SalesTrendPoint } from "@/types";

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// A small dependency-free SVG bar chart (no charting library exists in
// this project yet, and the phase says to avoid adding one unless
// reusing an existing one — see PROJECT_PROGRESS.md) plus the same data
// as a plain table underneath. The table isn't a fallback for the
// chart's sake — SVG <rect> bars have no reliable screen-reader-readable
// values, so the table is what actually satisfies "readable on mobile
// and accessible", with the chart as a visual bonus on top of it.
export function SalesTrendChart({ points }: { points: SalesTrendPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No orders in this range.</p>;
  }

  const max = Math.max(...points.map((point) => point.deliveredSales), 1);
  const barWidth = 100 / points.length;

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-32 w-full sm:h-40"
        role="img"
        aria-label={`Delivered sales trend from ${formatShortDate(points[0].date)} to ${formatShortDate(points[points.length - 1].date)}`}
      >
        {points.map((point, index) => {
          const height = (point.deliveredSales / max) * 36;
          return (
            <rect
              key={point.date}
              x={index * barWidth + barWidth * 0.15}
              y={40 - height}
              width={Math.max(barWidth * 0.7, 0.5)}
              height={height}
              className="fill-primary"
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatShortDate(points[0].date)}</span>
        <span>{formatShortDate(points[points.length - 1].date)}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-1.5 font-medium">Date</th>
              <th className="py-1.5 text-right font-medium">Orders</th>
              <th className="py-1.5 text-right font-medium">Delivered sales</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {points.map((point) => (
              <tr key={point.date}>
                <td className="py-1.5 text-foreground">{formatShortDate(point.date)}</td>
                <td className="py-1.5 text-right text-muted-foreground">{point.orderCount}</td>
                <td className="py-1.5 text-right text-foreground">{formatCurrency(point.deliveredSales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
