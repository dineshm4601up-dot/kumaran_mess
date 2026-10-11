"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { InputField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";

export function ChangePinClient() {
  const router = useRouter();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [errors, setErrors] = useState<{ currentPin?: string; newPin?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: { currentPin?: string; newPin?: string } = {};
    if (!/^\d{4}$/.test(currentPin)) nextErrors.currentPin = "Enter the 4-digit PIN you just logged in with.";
    if (!/^\d{4}$/.test(newPin) || newPin !== confirmPin) {
      nextErrors.newPin = "Enter a new 4-digit PIN, matching in both fields.";
    }
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin, confirmPin }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.error === "locked") {
          const until = data.lockedUntil ? new Date(data.lockedUntil) : null;
          setFormError(
            until
              ? `Too many incorrect attempts. Try again after ${until.toLocaleTimeString()}.`
              : "Too many incorrect attempts. Try again later.",
          );
        } else if (data.error === "incorrect_current_pin") {
          setErrors({ currentPin: "That's not correct." });
        } else {
          setFormError("Something went wrong. Please try again.");
        }
        return;
      }

      router.push("/");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Set a new PIN</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your PIN was reset by our team. Please set your own 4-digit PIN to continue.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <InputField
          label="Current (temporary) PIN"
          required
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={currentPin}
          onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, ""))}
          error={errors.currentPin}
        />

        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="New 4-digit PIN"
            required
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ""))}
            error={errors.newPin}
          />
          <InputField
            label="Confirm PIN"
            required
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirmPin}
            onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ""))}
          />
        </div>

        <Button type="submit" size="lg" isLoading={isSubmitting} fullWidth>
          Set new PIN
        </Button>

        {formError && <InfoBanner tone="warning">{formError}</InfoBanner>}
      </form>
    </div>
  );
}
