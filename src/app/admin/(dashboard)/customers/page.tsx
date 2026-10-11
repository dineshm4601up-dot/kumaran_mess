import type { Metadata } from "next";
import { getAdminCustomerList } from "@/lib/admin-customers";
import { CustomersTable } from "@/components/admin/CustomersTable";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Customers",
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const customers = await getAdminCustomerList(q ?? null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search by name or registered phone number.</p>
      </div>

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Priya, 98765..."
          aria-label="Search customers"
          className="w-full max-w-sm rounded-[var(--radius-control)] border border-border bg-surface px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-2 focus:outline-offset-1 focus:outline-primary"
        />
      </form>

      {customers.length === 0 ? (
        <EmptyState icon="👤" title={q ? "No matching customers" : "No customers yet"} />
      ) : (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface">
          <CustomersTable customers={customers} />
        </div>
      )}
    </div>
  );
}
