import { OrderStatusBadge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";
import type { BillData } from "@/types";

// Pure, presentational, read-only — no form inputs, no mutation
// capability anywhere in this component (requirement E.3). Every value
// here comes from BillData, itself built only from the order/order_items
// rows and the shop's *current* display settings — never from current
// product prices (requirement E.10). React escapes all of this text by
// construction (plain JSX interpolation, no dangerouslySetInnerHTML
// anywhere) — requirement E.7.
export function BillDocument({ bill }: { bill: BillData }) {
  const placedAt = new Date(bill.createdAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="bill-print-area mx-auto max-w-2xl rounded-[var(--radius-card)] border border-border bg-surface p-6 print:border-0 print:p-0 print:shadow-none">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">{bill.shopName}</h1>
          {bill.shopAddress && <p className="text-sm text-muted-foreground">{bill.shopAddress}</p>}
          {bill.shopPhone && <p className="text-sm text-muted-foreground">Phone: {bill.shopPhone}</p>}
          {bill.isTaxInvoice && bill.gstin && (
            <p className="mt-1 text-sm text-muted-foreground">GSTIN: {bill.gstin}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">
            {bill.isTaxInvoice ? "Tax Invoice" : "Order Receipt"}
          </p>
          <p className="text-sm text-muted-foreground">{bill.orderNumber}</p>
          <p className="text-xs text-muted-foreground">{placedAt}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <OrderStatusBadge status={bill.status} />
        {bill.status === "cancelled" && bill.cancelledReason && (
          <p className="text-sm text-danger">Cancelled: {bill.cancelledReason}</p>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Billed to</p>
          <p className="mt-1 text-sm text-foreground">{bill.customerName}</p>
          <p className="text-sm text-muted-foreground">{bill.customerPhone}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Delivery address</p>
          <p className="mt-1 text-sm text-foreground">{bill.deliveryAddressLine}</p>
          {bill.deliveryLandmark && <p className="text-sm text-muted-foreground">Near {bill.deliveryLandmark}</p>}
          {bill.deliveryInstructions && (
            <p className="text-sm text-muted-foreground">Note: {bill.deliveryInstructions}</p>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit price</th>
              <th className="py-2 text-right font-medium">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bill.items.map((item) => (
              <tr key={item.id}>
                <td className="py-2 text-foreground">{item.productName}</td>
                <td className="py-2 text-right text-muted-foreground">{item.quantity}</td>
                <td className="py-2 text-right text-muted-foreground">{formatCurrency(item.price)}</td>
                <td className="py-2 text-right text-foreground">{formatCurrency(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-foreground">{formatCurrency(bill.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Delivery fee</span>
          <span className="text-foreground">{formatCurrency(bill.deliveryFee)}</span>
        </div>
        {bill.isTaxInvoice && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              Tax{bill.taxRatePercent !== null ? ` (${bill.taxRatePercent}%)` : ""}
            </span>
            <span className="text-foreground">{formatCurrency(bill.taxAmount)}</span>
          </div>
        )}
        <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
          <span className="text-foreground">Total</span>
          <span className="text-foreground">{formatCurrency(bill.total)}</span>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-3 text-sm">
        <p className="text-foreground">
          Payment: Cash on Delivery &mdash;{" "}
          <span className="font-medium">
            {bill.paymentStatus === "collected"
              ? "Collected"
              : bill.paymentStatus === "refused"
                ? "Refused"
                : "Pending"}
          </span>
        </p>
      </div>

      {!bill.isTaxInvoice && (
        <p className="mt-4 text-xs text-muted-foreground">
          This is a plain order receipt, not a tax invoice — no tax registration details apply.
        </p>
      )}
    </div>
  );
}
