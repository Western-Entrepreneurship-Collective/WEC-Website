import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/lib/os/actions/auth";
import { Shell, type NavItem } from "@/components/os/Shell";
import { initials } from "@/lib/os/initials";
import { supabaseEnv } from "@/lib/os/config";
import { displayName, requireMe } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseEnv()) redirect("/os/login");
  const me = await requireMe();
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  const nav: NavItem[] = [
    { href: "/os", label: "My tasks" },
    { href: "/os/projects", label: "Projects" },
    { href: "/os/events", label: "Events" },
    { href: "/os/teams", label: "Teams" },
    { href: "/os/calendar", label: "Calendar" },
    ...(me.is_president ? [{ href: "/os/president", label: "All of WEC" }] : []),
    ...(me.is_admin ? [{ href: "/os/admin", label: "Admin" }] : []),
  ];
  return (
    <Shell
      nav={nav}
      inbox={count ?? 0}
      me={(
        <details className="os-me-menu">
          <summary aria-label={`Signed in as ${displayName(me)}`}>{initials(displayName(me))}</summary>
          <div>
            <p><strong>{displayName(me)}</strong><small>{me.positions.map(p => p.title).join(", ") || (me.is_admin ? "System Administrator" : "No position yet")}</small></p>
            <Link href="/os/profile">Your profile</Link>
            <Link href="/os/sops">SOP library</Link>
            <Link href="/os/meetings">Meeting notes</Link>
            <form action={logout}><button type="submit">Sign out</button></form>
          </div>
        </details>
      )}
    >
      {children}
    </Shell>
  );
}
