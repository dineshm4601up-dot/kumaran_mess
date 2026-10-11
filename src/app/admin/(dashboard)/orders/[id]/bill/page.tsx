import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminBillData } from "@/lib/bills";
import { BillDocument } from "@/components/bill/BillDocument";
import { BillActions } from "@/components/bill/BillActions";

export const metadata: Metadata = {
  title: "Bill",
};

export default async function AdminBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Authorization here is the dashboard layout's is_staff() gate (same
  // as every other /admin/* page) — this page itself has no additional
  // ownership filter, matching the admin order detail page's pattern.
  const bill = await getAdminBillData(id);
  if (!bill) {
    notFound();
  }

  return (
    <div>
      <BillActions backHref={`/admin/orders/${id}`} backLabel="Back to order" />
      <BillDocument bill={bill} />
    </div>
  );
}
