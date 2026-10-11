import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { resolveReportDateRange, isReportDateRangePreset } from "@/lib/report-dates";
import {
  getCustomerWiseReport,
  getOrderDetailsReport,
  getProductWiseReport,
  getReportSummary,
  getSalesTrend,
} from "@/lib/reports";
import { ReportFilters } from "@/components/admin/reports/ReportFilters";
import { MonthlySalesReport } from "@/components/admin/reports/MonthlySalesReport";
import { CustomerWiseReport } from "@/components/admin/reports/CustomerWiseReport";
import { ProductWiseReport } from "@/components/admin/reports/ProductWiseReport";
import { OrderDetailsReport } from "@/components/admin/reports/OrderDetailsReport";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { Button } from "@/components/ui/Button";
import type { OrderStatus, ReportDateRangePreset } from "@/types";

export const metadata: Metadata = {
  title: "Reports",
};

const TABS: { value: string; label: string; exportFilename: (start: string, end: string) => string }[] = [
  { value: "monthly-sales", label: "Monthly Sales", exportFilename: (_s, e) => `monthly_sales_${e.slice(0, 7)}.xlsx` },
  { value: "customer-wise", label: "Customer-wise", exportFilename: () => "customer_wise_sales.xlsx" },
  { value: "product-wise", label: "Product-wise", exportFilename: () => "product_wise_sales.xlsx" },
  { value: "order-details", label: "Order Details", exportFilename: (s, e) => `order_details_${s}_to_${e}.xlsx` },
];

const ALLOWED_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; preset?: string; start?: string; end?: string; status?: string }>;
}) {
  const params = await searchParams;
  const tab = TABS.some((t) => t.value === params.tab) ? params.tab! : "monthly-sales";
  const preset: ReportDateRangePreset = isReportDateRangePreset(params.preset) ? params.preset : "this_month";
  const status: OrderStatus | null = ALLOWED_STATUSES.includes(params.status as OrderStatus)
    ? (params.status as OrderStatus)
    : null;

  const resolved = resolveReportDateRange(preset, params.start, params.end);
  const rangeInvalid = preset === "custom" && resolved === null;
  const range = resolved ?? resolveReportDateRange("this_month")!;

  const exportQuery = new URLSearchParams({ start: range.start, end: range.end });
  if (status) exportQuery.set("status", status);

  const activeTab = TABS.find((t) => t.value === tab)!;
  const exportHref = `/api/admin/reports/${tab}/export?${exportQuery.toString()}`;
  const exportFilename = activeTab.exportFilename(range.start, range.end);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Showing {range.start} to {range.end}
          {status ? ` — status: ${status.replace(/_/g, " ")}` : ""}.
        </p>
      </div>

      {rangeInvalid && (
        <InfoBanner tone="warning">
          That custom date range wasn&apos;t valid — showing this month&apos;s data instead.
        </InfoBanner>
      )}

      <ReportFilters tab={tab} preset={preset} start={range.start} end={range.end} status={status} />

      <nav aria-label="Report type" className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/reports?tab=${t.value}&preset=${preset}&start=${range.start}&end=${range.end}${status ? `&status=${status}` : ""}`}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
              t.value === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="flex justify-end">
        <a href={exportHref} download={exportFilename}>
          <Button type="button" variant="outline">
            ⬇ Export to Excel
          </Button>
        </a>
      </div>

      {tab === "monthly-sales" && <MonthlySalesTab start={range.start} end={range.end} status={status} />}
      {tab === "customer-wise" && <CustomerWiseTab start={range.start} end={range.end} status={status} />}
      {tab === "product-wise" && <ProductWiseTab start={range.start} end={range.end} status={status} />}
      {tab === "order-details" && <OrderDetailsTab start={range.start} end={range.end} status={status} />}
    </div>
  );
}

async function MonthlySalesTab({ start, end, status }: { start: string; end: string; status: OrderStatus | null }) {
  const [summary, trend] = await Promise.all([
    getReportSummary(start, end, status),
    getSalesTrend(start, end, status),
  ]);
  return <MonthlySalesReport summary={summary} trend={trend} />;
}

async function CustomerWiseTab({ start, end, status }: { start: string; end: string; status: OrderStatus | null }) {
  const rows = await getCustomerWiseReport(start, end, status);
  return <CustomerWiseReport rows={rows} />;
}

async function ProductWiseTab({ start, end, status }: { start: string; end: string; status: OrderStatus | null }) {
  const rows = await getProductWiseReport(start, end, status);
  return <ProductWiseReport rows={rows} />;
}

async function OrderDetailsTab({ start, end, status }: { start: string; end: string; status: OrderStatus | null }) {
  const rows = await getOrderDetailsReport(start, end, status);
  return <OrderDetailsReport rows={rows} />;
}
