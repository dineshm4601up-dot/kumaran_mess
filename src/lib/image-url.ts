const PRODUCT_IMAGES_BUCKET = "product-images";
const PLACEHOLDER = "/placeholder-product.svg";

// product-images is a public bucket, so the delivery URL is a plain,
// predictable path — no signed URL or extra round-trip needed. Falls
// back to a local placeholder when a product has no image yet.
export function getProductImageUrl(imagePath: string | null): string {
  if (!imagePath) return PLACEHOLDER;

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return PLACEHOLDER;

  return `${baseUrl}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${imagePath}`;
}

export { PRODUCT_IMAGES_BUCKET };
