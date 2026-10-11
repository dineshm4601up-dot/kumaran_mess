import "server-only";

// Deliberately the *only* thing this project does with WhatsApp today:
// build a wa.me URL with a prefilled, URL-encoded message. This is the
// official click-to-chat mechanism (https://faq.whatsapp.com/5913398998672934) —
// opening it only pre-fills the chat; WhatsApp itself requires the human
// to tap Send (requirement C.7/D — there is no way for a click-to-chat
// link to send a message automatically, and this project does not
// pretend otherwise).
//
// This file knows nothing about the official WhatsApp Business Platform
// API (Meta's Graph API for actually *sending* messages programmatically
// and receiving delivery-status webhooks) and never will — see
// PROJECT_PROGRESS.md's "WhatsApp integration architecture" section for
// where that would live if/when it's built: a separate
// src/lib/whatsapp/provider.ts-style adapter, server-only secrets, a
// webhook route, and explicit consent tracking, none of which exist yet.
export function buildWhatsAppClickToChatUrl(normalizedPhoneDigits: string, message: string): string {
  return `https://wa.me/${normalizedPhoneDigits}?text=${encodeURIComponent(message)}`;
}

// Accepts the project's stored E.164 format (+91XXXXXXXXXX, set at
// registration — see Phase 3) and returns the digits-only form wa.me
// expects, or null if it doesn't look like a real Indian mobile number.
// Handling this explicitly (rather than assuming every stored phone is
// well-formed) is requirement C.9 ("handle missing or invalid phone
// numbers safely").
export function toWhatsAppPhoneDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // Accept "91XXXXXXXXXX" (12 digits) as stored, or a bare 10-digit
  // number defensively in case a future data path ever stores one
  // without the country code.
  if (/^91[6-9]\d{9}$/.test(digits)) return digits;
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  return null;
}
