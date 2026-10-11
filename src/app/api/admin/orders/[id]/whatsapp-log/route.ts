import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Records only that staff opened the click-to-chat compose window for
// this order — not that a message was sent or delivered (requirement
// E.6: audit the admin action; requirement C.7/D: opening the link is
// not proof of sending). Called fire-and-forget right when the admin
// clicks "Send WhatsApp Confirmation", alongside window.open().
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("order_whatsapp_log").insert({
    order_id: id,
    channel: "click_to_chat",
    triggered_by: staff.userId,
  });

  if (error) {
    console.error("admin/orders/[id]/whatsapp-log POST:", error);
    return NextResponse.json({ error: "log_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
