import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isValidSlug } from "@/lib/validation/slug";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const update: Record<string, unknown> = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
    update.name = name;
  }
  if (typeof body?.slug === "string") {
    const slug = body.slug.trim();
    if (!isValidSlug(slug)) return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
    update.slug = slug;
  }
  if (typeof body?.description === "string" || body?.description === null) {
    update.description = body.description?.trim() || null;
  }
  if (body?.displayOrder !== undefined) {
    update.display_order = Number(body.displayOrder) || 0;
  }
  if (typeof body?.isActive === "boolean") {
    update.is_active = body.isActive;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("categories").update(update).eq("id", id);

  if (error) {
    const isDuplicateSlug = error.code === "23505";
    console.error("admin/categories PATCH:", error);
    return NextResponse.json(
      { error: isDuplicateSlug ? "slug_taken" : "update_failed" },
      { status: isDuplicateSlug ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
