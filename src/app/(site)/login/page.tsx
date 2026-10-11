"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InputField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";

type FormValues = {
  mobile: string;
  pin: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!/^[6-9]\d{9}$/.test(values.mobile.trim())) {
    errors.mobile = "Enter a valid 10-digit mobile number.";
  }
  if (!/^\d{4}$/.test(values.pin)) {
    errors.pin = "PIN must be exactly 4 digits.";
  }
  return errors;
}

export default function LoginPage() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({ mobile: "", pin: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: values.mobile, pin: values.pin }),
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
        } else {
          setFormError("Incorrect mobile number or PIN.");
        }
        return;
      }

      // An admin-assisted PIN reset forces a PIN change before anything
      // else — redirect there regardless of ?next (requirement 3, step 7).
      if (data.mustChangePin) {
        router.push("/change-pin");
        router.refresh();
        return;
      }

      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Log in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Use your registered mobile number and 4-digit PIN.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <InputField
          label="Mobile number"
          required
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={values.mobile}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, mobile: event.target.value.replace(/\D/g, "") }))
          }
          error={errors.mobile}
          autoComplete="tel"
        />

        <InputField
          label="4-digit PIN"
          required
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={values.pin}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, pin: event.target.value.replace(/\D/g, "") }))
          }
          error={errors.pin}
        />

        <Button type="submit" size="lg" isLoading={isSubmitting} fullWidth>
          Log in
        </Button>

        {formError && <InfoBanner tone="warning">{formError}</InfoBanner>}
      </form>

      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-pin" className="font-medium text-primary hover:underline">
          Forgot PIN?
        </Link>
      </p>

      <p className="mt-2 text-center text-sm text-muted-foreground">
        New to Kumaran Mess?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
