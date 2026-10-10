"use client";

import { useState, type FormEvent } from "react";
import { InputField, TextAreaField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { LocationPicker } from "@/components/checkout/LocationPicker";
import type { CustomerAddress } from "@/types";

export function AddressForm({
  address,
  requireLocation,
  onSaved,
  onCancel,
}: {
  address?: CustomerAddress;
  requireLocation: boolean;
  onSaved: (address: CustomerAddress) => void;
  onCancel?: () => void;
}) {
  const [addressLine, setAddressLine] = useState(address?.addressLine ?? "");
  const [landmark, setLandmark] = useState(address?.landmark ?? "");
  const [deliveryInstructions, setDeliveryInstructions] = useState(address?.deliveryInstructions ?? "");
  const [latitude, setLatitude] = useState<number | null>(address?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(address?.longitude ?? null);
  const [errors, setErrors] = useState<{ address?: string; location?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: { address?: string; location?: string } = {};
    if (!addressLine.trim()) nextErrors.address = "Enter a delivery address.";
    if (requireLocation && (latitude === null || longitude === null)) {
      nextErrors.location = "This address needs a pinned location — please use search, your current location, or click the map.";
    }
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        addressLine: addressLine.trim(),
        landmark: landmark.trim() || null,
        deliveryInstructions: deliveryInstructions.trim() || null,
        latitude,
        longitude,
        isDefault: true,
      };

      const response = await fetch(address ? `/api/addresses/${address.id}` : "/api/addresses", {
        method: address ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setFormError("Something went wrong saving this address.");
        return;
      }

      onSaved({
        id: address?.id ?? data.id,
        addressLine: payload.addressLine,
        landmark: payload.landmark,
        deliveryInstructions: payload.deliveryInstructions,
        latitude,
        longitude,
        isDefault: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <TextAreaField
        label="Delivery address"
        required
        rows={2}
        value={addressLine}
        onChange={(event) => setAddressLine(event.target.value)}
        error={errors.address}
      />
      <InputField label="Landmark (optional)" value={landmark} onChange={(event) => setLandmark(event.target.value)} />
      <TextAreaField
        label="Delivery instructions (optional)"
        rows={2}
        value={deliveryInstructions}
        onChange={(event) => setDeliveryInstructions(event.target.value)}
      />

      <div>
        <span className="text-sm font-medium text-foreground">
          Pin your location {requireLocation ? "(required for this address)" : "(optional)"}
        </span>
        <div className="mt-2">
          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            onChange={(lat, lon) => {
              setLatitude(lat);
              setLongitude(lon);
            }}
          />
        </div>
        {errors.location && <p className="mt-1 text-sm text-danger">{errors.location}</p>}
      </div>

      <div className="flex gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          Save address
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      {formError && <InfoBanner tone="warning">{formError}</InfoBanner>}
    </form>
  );
}
