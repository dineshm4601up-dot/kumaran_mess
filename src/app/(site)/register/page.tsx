"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InputField, TextAreaField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";

type FormValues = {
  fullName: string;
  mobile: string;
  pin: string;
  confirmPin: string;
  address: string;
  landmark: string;
  email: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  fullName: "",
  mobile: "",
  pin: "",
  confirmPin: "",
  address: "",
  landmark: "",
  email: "",
};

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.fullName.trim()) {
    errors.fullName = "Enter your full name.";
  }
  if (!/^[6-9]\d{9}$/.test(values.mobile.trim())) {
    errors.mobile = "Enter a valid 10-digit mobile number.";
  }
  if (!/^\d{4}$/.test(values.pin)) {
    errors.pin = "PIN must be exactly 4 digits.";
  }
  if (values.confirmPin !== values.pin) {
    errors.confirmPin = "PINs do not match.";
  }
  if (!values.address.trim()) {
    errors.address = "Enter a delivery address.";
  }
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}

export default function RegisterPage() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

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
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: values.mobile,
          fullName: values.fullName,
          pin: values.pin,
          confirmPin: values.confirmPin,
          email: values.email || undefined,
          addressLine: values.address,
          landmark: values.landmark || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFormError(
          data.error === "already_registered"
            ? "That mobile number is already registered. Try logging in instead."
            : "Something went wrong creating your account. Please try again.",
        );
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
      <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Register with your mobile number to order from Kumaran Mess.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <InputField
          label="Full name"
          required
          value={values.fullName}
          onChange={(event) => updateField("fullName", event.target.value)}
          error={errors.fullName}
          autoComplete="name"
        />

        <InputField
          label="Mobile number"
          required
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={values.mobile}
          onChange={(event) => updateField("mobile", event.target.value.replace(/\D/g, ""))}
          error={errors.mobile}
          hint="This will be your login ID."
          autoComplete="tel"
        />

        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="4-digit PIN"
            required
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={values.pin}
            onChange={(event) => updateField("pin", event.target.value.replace(/\D/g, ""))}
            error={errors.pin}
          />
          <InputField
            label="Confirm PIN"
            required
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={values.confirmPin}
            onChange={(event) => updateField("confirmPin", event.target.value.replace(/\D/g, ""))}
            error={errors.confirmPin}
          />
        </div>

        <TextAreaField
          label="Delivery address"
          required
          value={values.address}
          onChange={(event) => updateField("address", event.target.value)}
          error={errors.address}
          hint="You can adjust this on a map when placing an order, once that's built."
        />

        <InputField
          label="Landmark (optional)"
          value={values.landmark}
          onChange={(event) => updateField("landmark", event.target.value)}
        />

        <InputField
          label="Email (optional)"
          type="email"
          value={values.email}
          onChange={(event) => updateField("email", event.target.value)}
          error={errors.email}
          autoComplete="email"
        />

        <Button type="submit" size="lg" isLoading={isSubmitting} fullWidth>
          Create account
        </Button>

        {formError && <InfoBanner tone="warning">{formError}</InfoBanner>}
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
