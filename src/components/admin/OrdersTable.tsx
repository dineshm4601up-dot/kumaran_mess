import Link from "next/link";
import { OrderStatusBadge, Badge } from "@/components/ui/Badge";
import { CallButton } from "@/components/shared/CallButton";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { AdminOrderListItem } from "@/types";

// Renders the same order rows two ways: a normal <table> from md
// upward, and a stacked card list below it — a <table> squeezed into a
// 320-375px phone forces either horizontal scrolling or unreadably
// truncated cells, so narrow screens get the row's fields restacked as
// a card instead. Shared by the dashboard's "Recent orders" and the
// full admin orders list so both stay in sync rather than drifting.
export function OrdersTable({ orders }: { orders: AdminOrderListItem[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Order #</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Placed</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Payment</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Call</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-surface-muted">
                <td className="px-4 py-3 font-medium text-foreground">
                  <Link href={`/admin/orders/${order.id}`} className="block">
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <Link href={`/admin/orders/${order.id}`} className="block">
                    {order.customerName}
                    <span className="block text-xs">{order.customerPhone}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <Link href={`/admin/orders/${order.id}`} className="block">
                    {formatDateTime(order.createdAt)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground">
                  <Link href={`/admin/orders/${order.id}`} className="block">
                    {formatCurrency(order.total)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={order.paymentStatus === "collected" ? "success" : "neutral"}>
                    {order.paymentStatus}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                {/* Deliberately its own <td>, not nested inside the Link
                    cells above — an <a> inside an <a> is invalid HTML
                    and would make clicks unpredictable. */}
                <td className="px-4 py-3">
                  <CallButton phone={order.customerPhone} label={`Call ${order.customerName.split(" ")[0]}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col divide-y divide-border md:hidden">
        {orders.map((order) => (
          <li key={order.id} className="flex items-center gap-2 p-4 hover:bg-surface-muted">
            <Link href={`/admin/orders/${order.id}`} className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{order.orderNumber}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {order.customerName} &middot; {order.customerPhone}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{formatDateTime(order.createdAt)}</span>
                <span className="font-medium text-foreground">{formatCurrency(order.total)}</span>
              </div>
              <div className="mt-2">
                <Badge tone={order.paymentStatus === "collected" ? "success" : "neutral"}>
                  {order.paymentStatus}
                </Badge>
              </div>
            </Link>
            {/* A sibling of the Link above, not nested inside it — same
                reason as the desktop table's separate Call column. */}
            <CallButton phone={order.customerPhone} label={`Call ${order.customerName.split(" ")[0]}`} />
          </li>
        ))}
      </ul>
    </>
  );
}
