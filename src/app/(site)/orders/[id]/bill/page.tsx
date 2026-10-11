import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-session";
import { getCustomerBillData } from "@/lib/bills";
import { BillDocument } from "@/components/bill/BillDocument";
import { BillActions } from "@/components/bill/BillActions";

export const metadata: Metadata = {
  title: "Bill",
};

export default async function CustomerBillPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/login?next=/orders");
  }

  const { id } = await params;

  // Scoped to session.customerId inside getCustomerBillData — same
  // ownership guarantee as the order detail page (requirement A.7 /
  // E.2: customers can view only their own bills).
  const bill = await getCustomerBillData(id, session.customerId);
  if (!bill) {
    notFound();
  }

  return (
    <div className="px-4 py-8 sm:px-6">
      <BillActions backHref={`/orders/${id}`} backLabel="Back to order" />
      <BillDocument bill={bill} />
    </div>
  );
}
