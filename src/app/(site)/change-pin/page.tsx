import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-session";
import { ChangePinClient } from "./ChangePinClient";

export const metadata: Metadata = {
  title: "Change PIN",
};

export default async function ChangePinPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/login?next=/change-pin");
  }

  return <ChangePinClient />;
}
