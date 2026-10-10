import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseProductBody } from "@/lib/validation/product";

export async function POST(request: Request) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { errors, values } = parseProductBody(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0] }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("products").insert(values).select("id").single();

  if (error) {
    console.error("admin/products POST:", error);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
