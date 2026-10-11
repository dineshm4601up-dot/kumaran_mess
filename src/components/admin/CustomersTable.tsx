import Link from "next/link";
import { CallButton } from "@/components/shared/CallButton";
import { formatCurrency } from "@/lib/format";
import type { AdminCustomerListItem } from "@/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Same table-on-desktop/cards-on-mobile pattern as OrdersTable.tsx — see
// that component's comment for why. The Call column/button is a sibling
// of each row's Link, never nested inside it, for the same reason.
export function CustomersTable({ customers }: { customers: AdminCustomerListItem[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Registered</th>
              <th className="px-4 py-2 font-medium">Orders</th>
              <th className="px-4 py-2 font-medium">Delivered sales</th>
              <th className="px-4 py-2 font-medium">Call</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-surface-muted">
                <td className="px-4 py-3 font-medium text-foreground">
                  <Link href={`/admin/customers/${customer.id}`} className="block">
                    {customer.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <Link href={`/admin/customers/${customer.id}`} className="block">
                    {customer.phone}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <Link href={`/admin/customers/${customer.id}`} className="block">
                    {formatDate(customer.createdAt)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground">
                  <Link href={`/admin/customers/${customer.id}`} className="block">
                    {customer.orderCount}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground">
                  <Link href={`/admin/customers/${customer.id}`} className="block">
                    {formatCurrency(customer.deliveredSales)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <CallButton phone={customer.phone} label={`Call ${customer.fullName.split(" ")[0]}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col divide-y divide-border md:hidden">
        {customers.map((customer) => (
          <li key={customer.id} className="flex items-center gap-2 p-4 hover:bg-surface-muted">
            <Link href={`/admin/customers/${customer.id}`} className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{customer.fullName}</p>
              <p className="truncate text-sm text-muted-foreground">
                {customer.phone} &middot; Registered {formatDate(customer.createdAt)}
              </p>
              <p className="mt-1 text-sm text-foreground">
                {customer.orderCount} order{customer.orderCount === 1 ? "" : "s"} &middot;{" "}
                {formatCurrency(customer.deliveredSales)} delivered
              </p>
            </Link>
            <CallButton phone={customer.phone} label={`Call ${customer.fullName.split(" ")[0]}`} />
          </li>
        ))}
      </ul>
    </>
  );
}
