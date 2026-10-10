import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Proxy (Next.js 16's renamed `middleware.ts` convention) does the
// *cheap* redirect-for-UX check only — presence of a cookie / validity of
// a Supabase JWT — never the real authorization decision. The real
// decision (does this specific session still exist and match a
// customer_sessions row / is this user actually staff) is made
// server-side in the page/layout/route handler that owns the data, via a
// real database check. Treating this file as the security boundary by
// itself is a known Next.js pitfall; it isn't one here.
//
// Kept independent of customer-session.ts (no import) so this file's
// runtime (Node by default as of Next 16, but this shouldn't depend on
// that) never has to care about that module's node:crypto usage. The
// cookie name is duplicated here; keep it in sync with
// CUSTOMER_SESSION_COOKIE_NAME in customer-session.ts if that ever changes.
const CUSTOMER_SESSION_COOKIE_NAME = "km_customer_session";

const CUSTOMER_ONLY_PREFIXES = ["/orders", "/checkout"];
const STAFF_ONLY_PREFIXES = ["/admin"];
const STAFF_PUBLIC_PATHS = ["/admin/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (CUSTOMER_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
    const hasCustomerCookie = request.cookies.has(CUSTOMER_SESSION_COOKIE_NAME);
    if (!hasCustomerCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (
    STAFF_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) &&
    !STAFF_PUBLIC_PATHS.includes(pathname)
  ) {
    let response = NextResponse.next();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value);
            }
            response = NextResponse.next({ request });
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      },
    );

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/orders/:path*", "/checkout/:path*", "/admin/:path*"],
};
