import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isValidSlug, slugify } from "@/lib/validation/slug";

export async function POST(request: Request) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const rawSlug = typeof body?.slug === "string" && body.slug.trim() ? body.slug.trim() : slugify(name);
  const description =
    typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
  const displayOrder = Number.isFinite(Number(body?.displayOrder)) ? Number(body.displayOrder) : 0;

  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  if (!isValidSlug(rawSlug)) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name, slug: rawSlug, description, display_order: displayOrder })
    .select("id")
    .single();

  if (error) {
    const isDuplicateSlug = error.code === "23505";
    console.error("admin/categories POST:", error);
    return NextResponse.json(
      { error: isDuplicateSlug ? "slug_taken" : "create_failed" },
      { status: isDuplicateSlug ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
