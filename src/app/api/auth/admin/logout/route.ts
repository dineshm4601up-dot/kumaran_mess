import { NextResponse } from "next/server";
import { getStaffSupabaseServerClient } from "@/lib/supabase/staff";

export async function POST() {
  const supabase = await getStaffSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
