import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminOrderDetail } from "@/lib/admin-orders";
import { getShopSettings } from "@/lib/shop-settings";
import { buildOrderConfirmationMessage } from "@/lib/whatsapp/message";
import { buildWhatsAppClickToChatUrl, toWhatsAppPhoneDigits } from "@/lib/whatsapp/click-to-chat";
import { AdminOrderDetailClient } from "@/components/admin/AdminOrderDetailClient";

export const metadata: Metadata = {
  title: "Order Details",
};

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, shop] = await Promise.all([getAdminOrderDetail(id), getShopSettings()]);

  if (!order) {
    notFound();
  }

  // Built server-side from authoritative order data, never from
  // anything the browser could supply (requirement C.5). The phone
  // number is validated here too (requirement C.9) — an invalid/missing
  // one simply results in no URL, and the button component shows a
  // clear "can't do this" state instead of a broken link.
  const whatsAppMessage = buildOrderConfirmationMessage(order, shop);
  const phoneDigits = toWhatsAppPhoneDigits(order.customerPhone);
  const whatsAppUrl = phoneDigits ? buildWhatsAppClickToChatUrl(phoneDigits, whatsAppMessage) : null;

  return (
    <AdminOrderDetailClient
      order={order}
      whatsAppUrl={whatsAppUrl}
      whatsAppMessage={whatsAppMessage}
      customerPhoneDisplay={order.customerPhone || null}
    />
  );
}
