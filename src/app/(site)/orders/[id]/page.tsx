import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-session";
import { getCustomerOrderDetail } from "@/lib/orders";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/types";
import { OrderDetailClient } from "./OrderDetailClient";

export const metadata: Metadata = {
  title: "Order Details",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/login?next=/orders");
  }

  const { id } = await params;

  // Scoped to session.customerId inside getCustomerOrderDetail — an id
  // belonging to another customer (guessed, or even known outright)
  // simply doesn't match and 404s, exactly like a nonexistent one.
  const order = await getCustomerOrderDetail(id, session.customerId);
  if (!order) {
    notFound();
  }

  const supabase = getSupabaseAdmin();
  const { data: settingsRow } = await supabase
    .from("shop_settings")
    .select("customer_cancellable_statuses")
    .limit(1)
    .maybeSingle();

  const cancellableStatuses = ((settingsRow?.customer_cancellable_statuses ?? []) as OrderStatus[]);

  return <OrderDetailClient initialOrder={order} cancellableStatuses={cancellableStatuses} />;
}
