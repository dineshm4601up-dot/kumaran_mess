import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PRODUCT_IMAGES_BUCKET, getProductImageUrl } from "@/lib/image-url";
import { extensionForType, validateImageFile } from "@/lib/validation/image";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  const validation = await validateImageFile(file);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existingProduct, error: fetchError } = await supabase
    .from("products")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existingProduct) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 });
  }

  const newPath = `products/${id}/${randomUUID()}.${extensionForType(validation.type)}`;

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(newPath, validation.bytes, { contentType: validation.type, upsert: false });

  if (uploadError) {
    console.error("admin/products/[id]/image POST upload:", uploadError);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("products")
    .update({ image_path: newPath })
    .eq("id", id);

  if (updateError) {
    console.error("admin/products/[id]/image POST db update:", updateError);
    // Clean up the file we just uploaded since the DB never ended up
    // pointing at it.
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([newPath]).catch(() => {});
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // Old image is now orphaned — best-effort cleanup. A failure here
  // leaves one unused file in storage, not an inconsistent database, so
  // it's logged rather than failing the request.
  if (existingProduct.image_path) {
    await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([existingProduct.image_path])
      .then(({ error }) => {
        if (error) console.error("admin/products/[id]/image POST cleanup:", error);
      });
  }

  return NextResponse.json({ ok: true, imagePath: newPath, imageUrl: getProductImageUrl(newPath) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: existingProduct, error: fetchError } = await supabase
    .from("products")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existingProduct) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 });
  }

  if (!existingProduct.image_path) {
    return NextResponse.json({ ok: true });
  }

  const { error: updateError } = await supabase
    .from("products")
    .update({ image_path: null })
    .eq("id", id);

  if (updateError) {
    console.error("admin/products/[id]/image DELETE db update:", updateError);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  const { error: removeError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([existingProduct.image_path]);

  if (removeError) {
    console.error("admin/products/[id]/image DELETE storage remove:", removeError);
  }

  return NextResponse.json({ ok: true });
}
