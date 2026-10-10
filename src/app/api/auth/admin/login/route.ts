import { NextResponse } from "next/server";
import { getStaffSupabaseServerClient } from "@/lib/supabase/staff";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const supabase = await getStaffSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  // Defense in depth: a valid Supabase Auth login alone doesn't make
  // someone staff — only a staff_users row does (see is_staff() /
  // provision_staff() in Phase 2's migrations).
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "not_staff" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
