"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { InputField } from "@/components/ui/FormField";
import { CallButton } from "@/components/shared/CallButton";
import { ResetPinDialog } from "@/components/admin/ResetPinDialog";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AdminCustomerDetail } from "@/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function CustomerDetailClient({ customer }: { customer: AdminCustomerDetail }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(customer.fullName);
  const [email, setEmail] = useState(customer.email ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email: email || null }),
      });
      if (!response.ok) {
        setSaveError("Couldn't save these changes.");
        return;
      }
      setIsEditing(false);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/customers" className="text-sm text-muted-foreground hover:text-primary">
          &larr; Customers
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{customer.fullName}</h1>
            <p className="text-sm text-muted-foreground">{customer.phone}</p>
            {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
            <p className="mt-1 text-xs text-muted-foreground">Registered {formatDate(customer.createdAt)}</p>
            {customer.pinResetRequired && (
              <div className="mt-2">
                <Badge tone="warning">PIN reset pending — must set a new PIN on next login</Badge>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <CallButton phone={customer.phone} label={`Call ${customer.fullName.split(" ")[0]}`} />
            <ResetPinDialog customerId={customer.id} customerName={customer.fullName} customerPhone={customer.phone} />
          </div>
        </div>
      </div>

      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Profile</h2>
          {!isEditing && (
            <Button type="button" size="sm" variant="outline" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="mt-3 flex flex-col gap-3">
            <InputField label="Full name" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
            <InputField
              label="Email (optional)"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Phone number can&apos;t be changed here — it&apos;s the customer&apos;s login identifier, and
              past orders/bills display it live rather than a frozen snapshot, so editing it would change how
              old orders show up too.
            </p>
            <div className="flex gap-2">
              <Button type="submit" size="sm" isLoading={isSaving}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setFullName(customer.fullName);
                  setEmail(customer.email ?? "");
                  setSaveError(null);
                }}
              >
                Cancel
              </Button>
            </div>
            {saveError && <InfoBanner tone="warning">{saveError}</InfoBanner>}
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Full name and email can be edited here. Phone, PIN, and account status are not editable from
            this form.
          </p>
        )}
      </section>

      <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Saved addresses</h2>
        {customer.addresses.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No saved addresses yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {customer.addresses.map((address) => (
              <li key={address.id} className="py-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{address.addressLine}</p>
                  {address.isDefault && <Badge tone="success">Default</Badge>}
                </div>
                {address.landmark && <p className="text-sm text-muted-foreground">Near {address.landmark}</p>}
                {address.deliveryInstructions && (
                  <p className="text-sm text-muted-foreground">Note: {address.deliveryInstructions}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--radius-card)] border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Order history</h2>
        </div>
        {customer.orders.length === 0 ? (
          <div className="p-4">
            <EmptyState icon="🧾" title="No orders yet" />
          </div>
        ) : (
          <OrdersTable orders={customer.orders} />
        )}
      </section>
    </div>
  );
}
