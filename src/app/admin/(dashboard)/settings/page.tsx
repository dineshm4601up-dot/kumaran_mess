import type { Metadata } from "next";
import { getShopSettings } from "@/lib/shop-settings";
import { ShopSettingsForm } from "@/components/admin/ShopSettingsForm";

export const metadata: Metadata = {
  title: "Shop Settings",
};

export default async function AdminSettingsPage() {
  const settings = await getShopSettings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Shop Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Delivery fee and minimum order apply to every checkout. The service radius only applies once
          both it and the store location are set. Shop details and tax settings appear on customer and
          admin bills.
        </p>
      </div>
      <ShopSettingsForm settings={settings} />
    </div>
  );
}
