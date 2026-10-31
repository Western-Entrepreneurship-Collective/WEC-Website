import { redirect } from "next/navigation";
import { logout } from "@/lib/os/actions/auth";
import { Shell, type NavItem } from "@/components/os/Shell";
import { supabaseEnv } from "@/lib/os/config";
import { displayName, requireMe } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseEnv()) redirect("/os/login");
  const me = await requireMe();
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);

  const nav: NavItem[] = [
    { href: "/os", label: "Dashboard", exact: true },
    { href: "/os/tasks", label: "My Tasks" },
    { href: "/os/calendar", label: "My Calendar" },
    { href: "/os/teams", label: "Teams" },
    { href: "/os/events", label: "Events" },
    { href: "/os/projects/global", label: "Global Projects" },
    { href: "/os/sops", label: "SOP Library" },
    { href: "/os/meetings", label: "Meetings" },
    { href: "/os/notifications", label: "Notifications", badge: count ?? 0 },
    ...(me.is_president ? [{ href: "/os/president", label: "President" }] : []),
    ...(me.is_admin ? [{ href: "/os/admin", label: "Administration" }] : []),
  ];

  return (
    <Shell
      nav={nav}
      footer={(
        <>
          <a className="os-me" href="/os/profile">
            <strong>{displayName(me)}</strong>
            <span>{me.positions.map(p => p.title).join(", ") || (me.is_admin ? "System Administrator" : "No position")}</span>
          </a>
          <form action={logout}><button type="submit" className="os-signout">Sign out</button></form>
        </>
      )}
    >
      {children}
    </Shell>
  );
}
