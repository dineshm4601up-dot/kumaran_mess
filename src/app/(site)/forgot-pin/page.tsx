"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InputField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";

export default function ForgotPinPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "reset">("phone");
  const [mobile, setMobile] = useState("");
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [resetErrors, setResetErrors] = useState<{ otp?: string; pin?: string }>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handlePhoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      setMobileError("Enter a valid 10-digit mobile number.");
      return;
    }
    setMobileError(null);

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-pin/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: mobile }),
      });
      const data = await response.json();
      setFormMessage(data.message ?? "If that mobile number is registered, a code has been sent.");
      setStep("reset");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: { otp?: string; pin?: string } = {};
    if (!/^\d{6}$/.test(otp)) nextErrors.otp = "Enter the 6-digit code.";
    if (!/^\d{4}$/.test(newPin) || newPin !== confirmPin) {
      nextErrors.pin = "Enter a 4-digit PIN, matching in both fields.";
    }
    setResetErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-pin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: mobile, otp, newPin, confirmPin }),
      });
      const data = await response.json();

      if (!response.ok) {
        setResetErrors({
          otp: data.error === "invalid_otp" ? "That code is incorrect or has expired." : undefined,
          pin: data.error === "invalid_pin" ? "Enter a 4-digit PIN, matching in both fields." : undefined,
        });
        if (!data.error || (data.error !== "invalid_otp" && data.error !== "invalid_pin")) {
          setFormMessage("Something went wrong. Please try again.");
        }
        return;
      }

      router.push("/");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === "reset") {
    return (
      <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-foreground">Reset your PIN</h1>
        {formMessage && (
          <div className="mt-3">
            <InfoBanner>{formMessage}</InfoBanner>
          </div>
        )}

        <form onSubmit={handleResetSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          <InputField
            label="Verification code"
            required
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            error={resetErrors.otp}
            autoComplete="one-time-code"
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
              error={resetErrors.pin}
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
            Reset PIN &amp; log in
          </Button>

          <button
            type="button"
            onClick={() => setStep("phone")}
            className="text-sm text-muted-foreground hover:text-primary"
          >
            Use a different mobile number
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Forgot your PIN?</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your registered mobile number and we&rsquo;ll send a verification code to reset it.
      </p>

      <form onSubmit={handlePhoneSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <InputField
          label="Mobile number"
          required
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={mobile}
          onChange={(event) => setMobile(event.target.value.replace(/\D/g, ""))}
          error={mobileError ?? undefined}
          autoComplete="tel"
        />

        <Button type="submit" size="lg" isLoading={isSubmitting} fullWidth>
          Send verification code
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
