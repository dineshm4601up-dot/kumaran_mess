// Builds a `tel:` link from a stored phone number — deliberately the
// only thing this does. Opening a `tel:` link only pre-fills the
// device's dialler; the user still has to press call themselves (no
// `tel:` link can place a call automatically), matching the same
// manual-action principle as this project's WhatsApp click-to-chat
// (src/lib/whatsapp/click-to-chat.ts). Not server-only — used from both
// server-rendered pages and client components (the customer header,
// admin order cards), so it has to run in the browser too.
//
// Accepts the project's stored E.164 format (+91XXXXXXXXXX) or a bare
// 10-digit Indian mobile number, and returns null for anything that
// doesn't look like a real one — callers show a clear "no phone number"
// state instead of rendering a broken link (requirement: "handle
// missing or invalid phone numbers with a clear message").
export function buildTelLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");

  if (/^\+91[6-9]\d{9}$/.test(digits)) return `tel:${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `tel:+${digits}`;
  if (/^[6-9]\d{9}$/.test(digits)) return `tel:+91${digits}`;
  return null;
}
