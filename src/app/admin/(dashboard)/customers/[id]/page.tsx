import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminCustomerDetail } from "@/lib/admin-customers";
import { CustomerDetailClient } from "@/components/admin/CustomerDetailClient";

export const metadata: Metadata = {
  title: "Customer Details",
};

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getAdminCustomerDetail(id);

  if (!customer) {
    notFound();
  }

  return <CustomerDetailClient customer={customer} />;
}
