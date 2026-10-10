import "server-only";

export function parseProductBody(body: Record<string, unknown> | null) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description =
    typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
  const price = Number(body?.price);
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  const stockQuantity = Number.isFinite(Number(body?.stockQuantity))
    ? Math.trunc(Number(body?.stockQuantity))
    : 0;
  const isAvailable = Boolean(body?.isAvailable);
  const isActive = body?.isActive === undefined ? true : Boolean(body?.isActive);
  const isFeatured = Boolean(body?.isFeatured);
  const displayOrder = Number.isFinite(Number(body?.displayOrder))
    ? Math.trunc(Number(body?.displayOrder))
    : 0;

  const errors: string[] = [];
  if (!name) errors.push("name_required");
  if (!categoryId) errors.push("category_required");
  if (!Number.isFinite(price) || price < 0) errors.push("invalid_price");
  if (stockQuantity < 0) errors.push("invalid_stock");

  return {
    errors,
    values: {
      name,
      description,
      price,
      category_id: categoryId,
      stock_quantity: stockQuantity,
      is_available: isAvailable,
      is_active: isActive,
      is_featured: isFeatured,
      display_order: displayOrder,
    },
  };
}
