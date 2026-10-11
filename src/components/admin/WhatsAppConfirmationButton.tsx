"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";

export function WhatsAppConfirmationButton({
  orderId,
  whatsAppUrl,
  message,
  phoneDisplay,
}: {
  orderId: string;
  whatsAppUrl: string | null;
  message: string;
  phoneDisplay: string | null;
}) {
  const [copyMessageState, setCopyMessageState] = useState<"idle" | "copied">("idle");
  const [copyPhoneState, setCopyPhoneState] = useState<"idle" | "copied">("idle");

  function logOpen() {
    // Fire-and-forget audit entry — never blocks opening WhatsApp, and a
    // failure here shouldn't stop the admin from proceeding.
    fetch(`/api/admin/orders/${orderId}/whatsapp-log`, { method: "POST" }).catch(() => {});
  }

  async function copyText(text: string, setState: (state: "idle" | "copied") => void) {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      // Clipboard API can be unavailable (older browser, permissions) —
      // silently do nothing rather than show a confusing error for a
      // fallback-of-a-fallback action.
    }
  }

  if (!whatsAppUrl) {
    return (
      <InfoBanner tone="warning">
        No valid WhatsApp-capable phone number on file for this customer — can&apos;t open a
        confirmation chat.
      </InfoBanner>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" onClick={logOpen}>
        <Button type="button">Send WhatsApp Confirmation</Button>
      </a>
      <p className="text-xs text-muted-foreground">
        This only opens WhatsApp with the message pre-filled — it does{" "}
        <strong>not</strong> send anything automatically. You still need to tap Send inside WhatsApp.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => copyText(message, setCopyMessageState)}>
          {copyMessageState === "copied" ? "Copied!" : "Copy message"}
        </Button>
        {phoneDisplay && (
          <Button type="button" variant="outline" size="sm" onClick={() => copyText(phoneDisplay, setCopyPhoneState)}>
            {copyPhoneState === "copied" ? "Copied!" : "Copy phone number"}
          </Button>
        )}
      </div>
    </div>
  );
}
