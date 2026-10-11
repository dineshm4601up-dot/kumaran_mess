import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { AdminNav } from "@/components/admin/AdminNav";
import { getStaffContext } from "@/lib/supabase/staff";

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  // The real authorization check (middleware only redirects on "no
  // apparent session at all" — this is the actual is_staff() decision).
  const staff = await getStaffContext();
  if (!staff) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <AdminTopbar staffEmail={staff.email} />
      <div className="flex flex-1">
        <AdminNav orientation="vertical" />
        {/* pb-16 reserves space for the fixed bottom nav on mobile
            (AdminNav orientation="horizontal", md:hidden) so page content
            never sits underneath it; md:pb-6 restores the normal padding
            once that nav disappears at the md breakpoint. */}
        <main className="flex-1 bg-surface-muted/40 p-4 pb-20 sm:px-6 md:pb-6">{children}</main>
      </div>
      <AdminNav orientation="horizontal" />
    </div>
  );
}
