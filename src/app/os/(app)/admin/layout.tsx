import type { Metadata } from "next";
import { requireAdmin } from "@/lib/os/dal";
import { AdminTabs } from "./tabs";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · WEC OS" } };

// Admins run the system rather than the work, so this looks like settings.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="os-admin">
      <AdminTabs />
      <div className="os-page os-admin-main">
        <header className="os-page-head">
          <div><h1>Admin</h1><p className="os-page-sub">You manage accounts and settings. You see names, dates and status, not what&apos;s inside tasks.</p></div>
        </header>
        {children}
      </div>
    </div>
  );
}
