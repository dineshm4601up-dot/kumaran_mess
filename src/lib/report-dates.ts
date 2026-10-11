import type { OrderStatus, ReportDateRangePreset } from "@/types";

const ALLOWED_REPORT_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

// All report date boundaries are the store's own Asia/Kolkata calendar
// days, matching the existing admin_dashboard_stats() convention
// (Phase 7) — computing "this month"/"this year" from the server's or
// browser's local clock would silently drift by whatever offset that
// clock is in, exactly the bug that convention was introduced to avoid.
function getKolkataTodayParts(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Plain Date-based day count — this is pure calendar arithmetic (no
// "current time" involved), so it isn't timezone-sensitive the way
// "what day is it right now" is.
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isValidYmd(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export type ResolvedDateRange = { start: string; end: string };

// Returns null for an invalid/missing custom range so callers can
// reject the request cleanly, rather than silently falling back to
// something the admin didn't ask for.
export function resolveReportDateRange(
  preset: ReportDateRangePreset,
  customStart?: string | null,
  customEnd?: string | null,
): ResolvedDateRange | null {
  const today = getKolkataTodayParts();

  if (preset === "this_month") {
    return { start: ymd(today.year, today.month, 1), end: ymd(today.year, today.month, today.day) };
  }

  if (preset === "last_month") {
    const month = today.month === 1 ? 12 : today.month - 1;
    const year = today.month === 1 ? today.year - 1 : today.year;
    return { start: ymd(year, month, 1), end: ymd(year, month, daysInMonth(year, month)) };
  }

  if (preset === "this_year") {
    return { start: ymd(today.year, 1, 1), end: ymd(today.year, today.month, today.day) };
  }

  // "custom" — string comparison is correct ordering for yyyy-mm-dd.
  if (!isValidYmd(customStart) || !isValidYmd(customEnd) || customStart > customEnd) {
    return null;
  }
  return { start: customStart, end: customEnd };
}

export function isReportDateRangePreset(value: unknown): value is ReportDateRangePreset {
  return value === "this_month" || value === "last_month" || value === "this_year" || value === "custom";
}

// Shared by all four export routes: the admin Reports page always links
// to an export with an already-resolved start/end/status (never a
// preset name), so exports parse exactly those three query params —
// this is the one place that parsing happens, rather than once per
// route. Returns null for a missing/malformed start or end so a route
// can reject the request cleanly.
export function parseReportQueryParams(
  searchParams: URLSearchParams,
): { start: string; end: string; status: OrderStatus | null } | null {
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    return null;
  }

  const statusParam = searchParams.get("status");
  const status = ALLOWED_REPORT_STATUSES.includes(statusParam as OrderStatus) ? (statusParam as OrderStatus) : null;

  return { start, end, status };
}
