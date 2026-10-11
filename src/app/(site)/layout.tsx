import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartProvider } from "@/lib/cart-context";
import { getCustomerSession } from "@/lib/customer-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getShopSettings } from "@/lib/shop-settings";

async function getInitialCustomer() {
  const session = await getCustomerSession();
  if (!session) return null;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("customer_profiles")
    .select("full_name")
    .eq("id", session.customerId)
    .maybeSingle();

  return data ? { fullName: data.full_name } : null;
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [initialCustomer, shopSettings] = await Promise.all([getInitialCustomer(), getShopSettings()]);

  return (
    <CartProvider>
      <Header initialCustomer={initialCustomer} shopPhone={shopSettings.shopPhone} />
      <main className="flex-1">{children}</main>
      <Footer />
    </CartProvider>
  );
}
