import Link from "next/link";
import type { ProductSortColumn, SortDirection } from "@/lib/product-sort";

// A plain GET link per header (no client JS) — clicking toggles
// ascending/descending via the URL's sort/dir params, which the server
// component re-reads; a different column always starts ascending
// (requirement: "a predictable default direction"). The ▲/▼ indicator
// is colored (primary) only when that column is the active sort, with a
// faint ⇕ on inactive columns so the clickable affordance is visible
// everywhere, not just on the active one — not color-only, since the
// label text itself and aria-label both state the direction too.
export function SortableHeader({
  column,
  label,
  activeColumn,
  activeDirection,
  buildHref,
}: {
  column: ProductSortColumn;
  label: string;
  activeColumn: ProductSortColumn | null;
  activeDirection: SortDirection;
  buildHref: (column: ProductSortColumn, direction: SortDirection) => string;
}) {
  const isActive = activeColumn === column;
  const nextDirection: SortDirection = isActive && activeDirection === "asc" ? "desc" : "asc";

  return (
    <th className="px-4 py-2 font-medium">
      <Link
        href={buildHref(column, nextDirection)}
        className="inline-flex items-center gap-1 rounded-[var(--radius-control)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={`Sort by ${label}, ${isActive ? (activeDirection === "asc" ? "currently ascending — click for descending" : "currently descending — click for ascending") : "click to sort ascending"}`}
      >
        <span>{label}</span>
        <span aria-hidden="true" className={isActive ? "text-primary" : "text-muted-foreground/50"}>
          {isActive ? (activeDirection === "asc" ? "▲" : "▼") : "⇕"}
        </span>
      </Link>
    </th>
  );
}
