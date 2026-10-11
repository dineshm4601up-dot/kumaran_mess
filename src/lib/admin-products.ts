import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapProductRow, type ProductRow } from "@/lib/supabase/mappers";
import type { Product } from "@/types";

const PRODUCT_COLUMNS =
  "id, name, description, price, image_path, category_id, is_available, is_active, is_featured, display_order, stock_quantity";

// Task 2: admin product search by name OR description, matching Tamil
// and English text case-insensitively — via admin_search_products()
// (a single server-side query, not a full-table download followed by
// client-side filtering). An empty/whitespace query returns every
// product, same as the page's previous unfiltered query did.
//
// Falls back to the plain unfiltered query this page used before this
// change if the RPC itself fails (most likely: the migration adding
// admin_search_products() hasn't been applied to this environment yet).
// Without this fallback, a page that worked perfectly well before this
// change would start showing "No products yet" for every product,
// search or not, until that migration lands — a regression this phase
// didn't need to introduce. The fallback only loses search filtering,
// never the product list itself.
export async function getAdminProducts(query: string | null): Promise<Product[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_search_products", { p_query: query });

  if (error) {
    console.error("admin_search_products (falling back to unfiltered product list):", error);
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .order("display_order", { ascending: true });

    if (fallbackError) {
      console.error("admin-products fallback query:", fallbackError);
      return [];
    }
    return ((fallbackRows ?? []) as ProductRow[]).map(mapProductRow);
  }

  return ((data ?? []) as ProductRow[]).map(mapProductRow);
}
