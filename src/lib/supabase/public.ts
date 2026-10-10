import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

// Anon-key client for public, unauthenticated reads (active categories,
// active products) — relies entirely on Phase 2/4's RLS policies, no
// cookies or session involved. Safe to use from Server Components.
export function getSupabasePublic(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.");
  }

  cached = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
