import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminOrderDetail } from "@/lib/admin-orders";
import { AdminOrderDetailClient } from "@/components/admin/AdminOrderDetailClient";

export const metadata: Metadata = {
  title: "Order Details",
};

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getAdminOrderDetail(id);

  if (!order) {
    notFound();
  }

  return <AdminOrderDetailClient order={order} />;
}
