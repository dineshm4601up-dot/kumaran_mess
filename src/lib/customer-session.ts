import "server-only";
import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const COOKIE_NAME = "km_customer_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, fixed (no sliding renewal yet)

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Issues a new session for customerId, sets the cookie on the current
// response, and returns the session row. The raw token only ever exists
// in the cookie and in this return value — the database only ever sees
// its hash.
export async function createCustomerSession(customerId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("customer_sessions").insert({
    customer_id: customerId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export type CustomerSessionContext = { customerId: string };

// Validates the session cookie against the database. This is the real
// authorization boundary — middleware only does a cheap presence check
// for redirect UX, never the actual decision (see middleware.ts).
export async function getCustomerSession(): Promise<CustomerSessionContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customer_sessions")
    .select("id, customer_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;

  // Best-effort activity timestamp; failure here shouldn't fail the request.
  void supabase
    .from("customer_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return { customerId: data.customer_id };
}

export async function destroyCustomerSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const supabase = getSupabaseAdmin();
    await supabase.from("customer_sessions").delete().eq("token_hash", hashToken(token));
  }

  cookieStore.delete(COOKIE_NAME);
}

export { COOKIE_NAME as CUSTOMER_SESSION_COOKIE_NAME };
