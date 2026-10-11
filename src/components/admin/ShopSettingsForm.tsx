"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { InputField, TextAreaField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";
import type { OrderStatus, ShopSettings } from "@/types";

const CANCELLABLE_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
];

export function ShopSettingsForm({ settings }: { settings: ShopSettings }) {
  const router = useRouter();
  const [shopName, setShopName] = useState(settings.shopName);
  const [shopAddress, setShopAddress] = useState(settings.shopAddress ?? "");
  const [shopPhone, setShopPhone] = useState(settings.shopPhone ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsappNumber ?? "");
  const [gstin, setGstin] = useState(settings.gstin ?? "");
  const [taxRatePercent, setTaxRatePercent] = useState(
    settings.taxRatePercent !== null ? String(settings.taxRatePercent) : "",
  );
  const [estimatedDeliveryMinutes, setEstimatedDeliveryMinutes] = useState(
    settings.estimatedDeliveryMinutes !== null ? String(settings.estimatedDeliveryMinutes) : "",
  );
  const [deliveryFee, setDeliveryFee] = useState(String(settings.deliveryFee));
  const [minOrderAmount, setMinOrderAmount] = useState(String(settings.minOrderAmount));
  const [serviceRadiusKm, setServiceRadiusKm] = useState(
    settings.serviceRadiusKm !== null ? String(settings.serviceRadiusKm) : "",
  );
  const [baseLatitude, setBaseLatitude] = useState(
    settings.baseLatitude !== null ? String(settings.baseLatitude) : "",
  );
  const [baseLongitude, setBaseLongitude] = useState(
    settings.baseLongitude !== null ? String(settings.baseLongitude) : "",
  );
  const [cancellableStatuses, setCancellableStatuses] = useState<OrderStatus[]>(
    settings.customerCancellableStatuses,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleStatus(status: OrderStatus) {
    setCancellableStatuses((prev) =>
      prev.includes(status) ? prev.filter((value) => value !== status) : [...prev, status],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName,
          shopAddress: shopAddress || null,
          shopPhone: shopPhone || null,
          whatsappNumber: whatsappNumber || null,
          gstin: gstin || null,
          taxRatePercent: taxRatePercent === "" ? null : Number(taxRatePercent),
          estimatedDeliveryMinutes: estimatedDeliveryMinutes === "" ? null : Number(estimatedDeliveryMinutes),
          deliveryFee: Number(deliveryFee),
          minOrderAmount: Number(minOrderAmount),
          serviceRadiusKm: serviceRadiusKm === "" ? null : Number(serviceRadiusKm),
          baseLatitude: baseLatitude === "" ? null : Number(baseLatitude),
          baseLongitude: baseLongitude === "" ? null : Number(baseLongitude),
          customerCancellableStatuses: cancellableStatuses,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message =
          data?.error === "invalid_shop_phone"
            ? "That contact number doesn't look like a valid Indian mobile number."
            : data?.error === "invalid_whatsapp_number"
              ? "That WhatsApp number doesn't look like a valid Indian mobile number."
              : "Something went wrong saving these settings.";
        setFormError(message);
        return;
      }

      setFormMessage("Saved.");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4" noValidate>
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Shop contact details</h2>
        <InputField label="Shop display name" required value={shopName} onChange={(event) => setShopName(event.target.value)} />
        <TextAreaField
          label="Shop address (optional)"
          rows={2}
          value={shopAddress}
          onChange={(event) => setShopAddress(event.target.value)}
        />
        <InputField
          label="Customer-facing contact number"
          value={shopPhone}
          onChange={(event) => setShopPhone(event.target.value)}
          hint="Shown on bills, and used by the customer-facing 'Call Kumaran Mess' button. An Indian mobile number — validated and normalised on save."
        />
        <InputField
          label="WhatsApp contact number (optional)"
          value={whatsappNumber}
          onChange={(event) => setWhatsappNumber(event.target.value)}
          hint="Only needed if it's different from the contact number above. Used for customer-to-shop WhatsApp links."
        />
      </div>

      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Tax (optional)</h2>
        <InputField
          label="GSTIN (optional)"
          value={gstin}
          onChange={(event) => setGstin(event.target.value)}
          hint="Display only — not validated or registered anywhere by this app."
        />
        <InputField
          label="Tax rate (%, optional)"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={taxRatePercent}
          onChange={(event) => setTaxRatePercent(event.target.value)}
          hint="Leave both this and GSTIN blank to issue plain receipts (no tax breakdown) instead of tax invoices. Applied to new orders only — past orders keep whatever was true when they were placed."
        />
      </div>

      <InputField
        label="Delivery fee (₹)"
        type="number"
        min="0"
        step="0.01"
        value={deliveryFee}
        onChange={(event) => setDeliveryFee(event.target.value)}
      />
      <InputField
        label="Minimum order amount (₹)"
        type="number"
        min="0"
        step="0.01"
        value={minOrderAmount}
        onChange={(event) => setMinOrderAmount(event.target.value)}
        hint="0 means no minimum."
      />
      <InputField
        label="Estimated delivery time (minutes, optional)"
        type="number"
        min="1"
        step="1"
        value={estimatedDeliveryMinutes}
        onChange={(event) => setEstimatedDeliveryMinutes(event.target.value)}
        hint="Only included in the WhatsApp order-confirmation message when set."
      />
      <InputField
        label="Service radius (km, optional)"
        type="number"
        min="0"
        step="0.1"
        value={serviceRadiusKm}
        onChange={(event) => setServiceRadiusKm(event.target.value)}
        hint="Leave blank for no delivery-area restriction. Requires the store location below to be set too."
      />
      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Store latitude"
          type="number"
          step="0.000001"
          value={baseLatitude}
          onChange={(event) => setBaseLatitude(event.target.value)}
        />
        <InputField
          label="Store longitude"
          type="number"
          step="0.000001"
          value={baseLongitude}
          onChange={(event) => setBaseLongitude(event.target.value)}
        />
      </div>

      <div>
        <span className="text-sm font-medium text-foreground">
          Customers may cancel their own order while it&apos;s in:
        </span>
        <div className="mt-2 flex flex-col gap-2">
          {CANCELLABLE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={cancellableStatuses.includes(option.value)}
                onChange={() => toggleStatus(option.value)}
                className="h-4 w-4 rounded border-border"
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Once an order is out for delivery or delivered, customers can never self-cancel it, regardless of
          this setting.
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          Save settings
        </Button>
      </div>

      {formMessage && <InfoBanner>{formMessage}</InfoBanner>}
      {formError && <InfoBanner tone="warning">{formError}</InfoBanner>}
    </form>
  );
}
