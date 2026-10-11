import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Edits only full_name/email — the exact same two columns customers are
// themselves allowed to edit (Phase 2: `grant update (full_name, email)
// to authenticated`). phone is deliberately never editable here: it's
// the login identifier, and the admin orders list/bill pages join live
// to customer_profiles.phone rather than storing a per-order snapshot,
// so changing it would retroactively change how a customer's phone
// displays on *past* orders too (requirement 6's "existing orders must
// retain their historical customer phone details"). Rather than add a
// phone-snapshot column (a larger schema change than this phase calls
// for), phone editing simply isn't offered. PIN-related columns are
// never in this payload at all — profile edits can never silently
// change credentials (requirement 3).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : null;

  if (!fullName) {
    return NextResponse.json({ error: "full_name_required" }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("customer_profiles")
    .update({ full_name: fullName, email })
    .eq("id", id);

  if (error) {
    console.error("admin/customers/[id] PATCH:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
