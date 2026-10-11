"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { buildTelLink } from "@/lib/phone-link";

// +919876543210 -> +91••••••3210 (requirement 3, step 4: "a partially
// masked phone number"). Falls back to the raw value for anything that
// doesn't look like E.164 rather than risk showing something wrong.
function maskPhone(phone: string): string {
  const match = phone.match(/^(\+\d{1,3})(\d+)(\d{4})$/);
  if (!match) return phone;
  const [, country, middle, last4] = match;
  return `${country}${"•".repeat(middle.length)}${last4}`;
}

// A convenience starting value only, not a security control — the real
// protection against a guessable temporary PIN is the same rate
// limiting/lockout verify_customer_pin() already enforces on every
// login attempt (and again on change_own_customer_pin()), not this
// number's randomness. The admin can edit it before confirming.
function generateRandomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function ResetPinDialog({
  customerId,
  customerName,
  customerPhone,
}: {
  customerId: string;
  customerName: string;
  customerPhone: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [newPin, setNewPin] = useState(() => generateRandomPin());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ whatsAppUrl: string | null } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  function open() {
    setNewPin(generateRandomPin());
    setError(null);
    setResult(null);
    setIsOpen(true);
  }

  async function handleConfirm() {
    if (!/^\d{4}$/.test(newPin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/reset-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error === "invalid_pin" ? "PIN must be exactly 4 digits." : "Couldn't reset the PIN.");
        return;
      }
      setResult({ whatsAppUrl: data.whatsAppUrl ?? null });
    } finally {
      setIsSubmitting(false);
    }
  }

  const telHref = buildTelLink(customerPhone);

  return (
    <>
      <Button type="button" variant="outline" onClick={open}>
        Reset Customer PIN
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-lg focus:outline-none"
          >
            {!result ? (
              <>
                <h2 id={titleId} className="text-base font-semibold text-foreground">
                  Reset PIN for {customerName}?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{maskPhone(customerPhone)}</p>
                <p className="mt-3 text-sm text-foreground">
                  They&apos;ll need to log in with the temporary PIN below, then they&apos;ll be required to
                  set their own new PIN right away.
                </p>

                <label htmlFor="temp-pin" className="mt-4 block text-sm font-medium text-foreground">
                  Temporary PIN
                </label>
                <input
                  id="temp-pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="mt-1 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3.5 py-2.5 text-sm tracking-widest focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Generated randomly — edit it if you&apos;d rather set a specific one.
                </p>

                {error && (
                  <div className="mt-3">
                    <InfoBanner tone="warning">{error}</InfoBanner>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Button type="button" variant="danger" isLoading={isSubmitting} onClick={handleConfirm}>
                    Confirm reset
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 id={titleId} className="text-base font-semibold text-foreground">
                  PIN reset for {customerName}
                </h2>
                <div className="mt-3">
                  <InfoBanner>PIN reset. Temporary PIN: {newPin}</InfoBanner>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  This doesn&apos;t notify the customer automatically — use Call or WhatsApp below to tell
                  them the temporary PIN yourself.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {telHref && (
                    <a href={telHref}>
                      <Button type="button" variant="outline">
                        📞 Call {customerName.split(" ")[0]}
                      </Button>
                    </a>
                  )}
                  {result.whatsAppUrl && (
                    <a href={result.whatsAppUrl} target="_blank" rel="noopener noreferrer">
                      <Button type="button" variant="outline">
                        Open WhatsApp
                      </Button>
                    </a>
                  )}
                </div>
                <div className="mt-4">
                  <Button type="button" onClick={() => setIsOpen(false)}>
                    Done
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
