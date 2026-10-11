"use client";

import { useState } from "react";
import type { OrderStatus, ReportDateRangePreset } from "@/types";

const PRESET_OPTIONS: { value: ReportDateRangePreset; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

const STATUS_OPTIONS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

// A plain GET form (no fetch, no client-side data loading) — submitting
// it just reloads /admin/reports with new query params, which the
// server component re-reads. The only reason this needs to be a client
// component at all is to show/hide the custom start/end date fields
// immediately as the admin picks "Custom range", before they submit.
export function ReportFilters({
  tab,
  preset,
  start,
  end,
  status,
}: {
  tab: string;
  preset: ReportDateRangePreset;
  start: string;
  end: string;
  status: OrderStatus | null;
}) {
  const [selectedPreset, setSelectedPreset] = useState<ReportDateRangePreset>(preset);

  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <input type="hidden" name="tab" value={tab} />

      <div className="flex flex-col gap-1">
        <label htmlFor="report-preset" className="text-xs font-medium text-muted-foreground">
          Date range
        </label>
        <select
          id="report-preset"
          name="preset"
          defaultValue={preset}
          onChange={(event) => setSelectedPreset(event.target.value as ReportDateRangePreset)}
          className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-primary"
        >
          {PRESET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {selectedPreset === "custom" && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="report-start" className="text-xs font-medium text-muted-foreground">
              Start date
            </label>
            <input
              id="report-start"
              type="date"
              name="start"
              defaultValue={start}
              className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="report-end" className="text-xs font-medium text-muted-foreground">
              End date
            </label>
            <input
              id="report-end"
              type="date"
              name="end"
              defaultValue={end}
              className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-primary"
            />
          </div>
        </>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="report-status" className="text-xs font-medium text-muted-foreground">
          Order status
        </label>
        <select
          id="report-status"
          name="status"
          defaultValue={status ?? ""}
          className="rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-primary"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Payment method</span>
        <select
          disabled
          defaultValue="cod"
          title="This shop currently supports Cash on Delivery only"
          className="rounded-[var(--radius-control)] border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground"
        >
          <option value="cod">Cash on Delivery (only method)</option>
        </select>
      </div>

      <button
        type="submit"
        className="rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Apply
      </button>
    </form>
  );
}
