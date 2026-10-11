import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getShopSettings } from "@/lib/shop-settings";
import { buildPinResetMessage } from "@/lib/whatsapp/message";
import { buildWhatsAppClickToChatUrl, toWhatsAppPhoneDigits } from "@/lib/whatsapp/click-to-chat";
import { isValidPin } from "@/lib/validation/phone";

// Admin-assisted PIN reset (requirement 3) — no OTP, no SMS. The
// temporary PIN is chosen by the admin client-side (ResetPinDialog
// generates a random one, editable) and arrives here once, in this
// request body; it is never echoed back in the response (the client
// already has it) and never logged (only customer_pin_resets' metadata
// — who/when, never what — is written, by the admin_reset_customer_pin
// RPC itself).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const newPin = typeof body?.newPin === "string" ? body.newPin : "";

  if (!isValidPin(newPin)) {
    return NextResponse.json({ error: "invalid_pin" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: updated, error } = await supabase.rpc("admin_reset_customer_pin", {
    p_customer_id: id,
    p_new_pin: newPin,
    p_staff_id: staff.userId,
  });

  if (error || !updated) {
    console.error("admin/customers/[id]/reset-pin POST:", error);
    return NextResponse.json({ error: "reset_failed" }, { status: 500 });
  }

  // Build the (not-automatically-sent) WhatsApp link server-side, same
  // principle as the order-confirmation flow (requirement 7: "the admin
  // must review and manually send the message"). Only this response's
  // own fields are returned — never updated.pin_hash, which the RPC's
  // return row does include but which is never read into this object.
  const shop = await getShopSettings();
  const phoneDigits = toWhatsAppPhoneDigits(updated.phone);
  const message = buildPinResetMessage(updated.full_name, shop.shopName, newPin);
  const whatsAppUrl = phoneDigits ? buildWhatsAppClickToChatUrl(phoneDigits, message) : null;

  return NextResponse.json({ ok: true, whatsAppUrl });
}
