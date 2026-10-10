"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InputField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";

type FormValues = {
  email: string;
  password: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.password) {
    errors.password = "Enter your password.";
  }
  return errors;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({ email: "", password: "" });
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
      const response = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();

      if (!response.ok) {
        setFormError(
          data.error === "not_staff"
            ? "This account isn't authorized for the admin dashboard."
            : "Incorrect email or password.",
        );
        return;
      }

      router.push("/admin");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-surface-muted px-4 py-10">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-sm">
        <div className="mb-6 text-center">
          <span className="text-2xl" aria-hidden="true">
            🔐
          </span>
          <h1 className="mt-2 text-xl font-bold text-foreground">Staff Login</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kumaran Mess admin dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <InputField
            label="Email"
            required
            type="email"
            value={values.email}
            onChange={(event) => setValues((prev) => ({ ...prev, email: event.target.value }))}
            error={errors.email}
            autoComplete="username"
          />
          <InputField
            label="Password"
            required
            type="password"
            value={values.password}
            onChange={(event) => setValues((prev) => ({ ...prev, password: event.target.value }))}
            error={errors.password}
            autoComplete="current-password"
          />

          <Button type="submit" size="lg" isLoading={isSubmitting} fullWidth>
            Log in
          </Button>

          {formError && <InfoBanner tone="warning">{formError}</InfoBanner>}
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/" className="font-medium text-primary hover:underline">
            Back to the storefront
          </Link>
        </p>
      </div>
    </div>
  );
}
