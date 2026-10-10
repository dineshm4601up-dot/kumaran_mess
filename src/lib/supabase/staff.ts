import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Staff/admin only: a real Supabase Auth session (email + password),
// cookie-backed via @supabase/ssr. This is a completely different
// mechanism from the customer session in customer-session.ts — different
// cookies, different table, different code path — which is what makes
// "a customer session cannot reach admin endpoints" true by construction
// rather than by convention.
export async function getStaffSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render, where cookies can't
          // be written — safe to ignore as long as middleware also
          // refreshes the session (standard @supabase/ssr caveat).
        }
      },
    },
  });
}

// True if the current request has a valid staff (admin or staff role)
// Supabase Auth session. Checks is_staff() in the database rather than
// trusting anything client-supplied.
export async function getStaffContext() {
  const supabase = await getStaffSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) return null;

  return { userId: userData.user.id, email: userData.user.email ?? null };
}
