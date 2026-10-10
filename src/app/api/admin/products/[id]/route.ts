import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseProductBody } from "@/lib/validation/product";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { errors, values } = parseProductBody(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0] }, { status: 400 });
  }

  // Editing a product never touches order_items — those keep their own
  // product_name_snapshot/product_price_snapshot taken at order time, so
  // existing orders are unaffected by this update (acceptance criterion).
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("products").update(values).eq("id", id);

  if (error) {
    console.error("admin/products PATCH:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
