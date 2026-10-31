import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/lib/os/actions/auth";
import { Shell, type NavGroup } from "@/components/os/Shell";
import { Avatar } from "@/components/os/ui";
import { supabaseEnv } from "@/lib/os/config";
import { displayName, requireMe } from "@/lib/os/dal";
import { getNeeds } from "@/lib/os/needs";
import { createClient } from "@/lib/os/supabase";

const ICONS = {
  home: "M4 11l8-7 8 7M6 10v10h12V10",
  tasks: "M9 6h11M9 12h11M9 18h11M4 6l1 1 1.5-2M4 12l1 1 1.5-2M4 18l1 1 1.5-2",
  projects: "M3 7h6l2 2h10v10H3zM3 7V5h6l2 2",
  calendar: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4",
  inbox: "M4 13l3-8h10l3 8v6H4zM4 13h5l1 3h4l1-3h5",
  team: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.5 2.5-6 6-6s6 2.5 6 6M16 5.5a3 3 0 010 5.5M18 14.5c2 .8 3 2.8 3 5.5",
  events: "M12 3l2.5 5.5 6 .7-4.5 4 1.2 6L12 16.3 6.8 19.2l1.2-6-4.5-4 6-.7z",
  global: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  teams: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  sops: "M5 4h10l4 4v12H5zM15 4v4h4M9 13h6M9 17h6",
  president: "M4 19h16M5 19V9l4 3 3-6 3 6 4-3v10",
  admin: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseEnv()) redirect("/os/login");
  const me = await requireMe();
  const supabase = await createClient();
  const [{ count }, needs, { data: requests }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    getNeeds(me),
    supabase.from("tasks").select("responsible_department_id").eq("request_state", "pending"),
  ]);

  // One line per team, however many positions someone holds in it.
  const teams = [...new Map(me.positions.map(p => [p.department_id, p])).values()];
  const nav: NavGroup[] = [
    { label: "My work", items: [
      { href: "/os", label: "Home", icon: ICONS.home, exact: true, badge: needs.items.length },
      { href: "/os/tasks", label: "Tasks", icon: ICONS.tasks },
      { href: "/os/projects", label: "Projects", icon: ICONS.projects },
      { href: "/os/calendar", label: "Calendar", icon: ICONS.calendar },
      { href: "/os/notifications", label: "Inbox", icon: ICONS.inbox, badge: count ?? 0 },
    ] },
    ...(teams.length ? [{ label: teams.length > 1 ? "My teams" : "My team", items: teams.map(t => ({
      href: `/os/teams/${t.department_slug}`, label: t.department_name, icon: ICONS.team,
      badge: t.is_head ? (requests ?? []).filter(r => r.responsible_department_id === t.department_id).length : 0,
    })) }] : []),
    { label: "Organization", items: [
      { href: "/os/events", label: "Events", icon: ICONS.events },
      { href: "/os/projects/global", label: "Global Projects", icon: ICONS.global },
      { href: "/os/teams", label: "All Teams", icon: ICONS.teams },
      { href: "/os/sops", label: "SOP Library", icon: ICONS.sops },
    ] },
    ...(me.is_president || me.is_admin ? [{ label: "Oversight", items: [
      ...(me.is_president ? [{ href: "/os/president", label: "President", icon: ICONS.president }] : []),
      ...(me.is_admin ? [{ href: "/os/admin", label: "Administration", icon: ICONS.admin }] : []),
    ] }] : []),
  ];

  return (
    <Shell
      nav={nav}
      footer={(
        <>
          <Link className="os-me" href="/os/profile">
            <Avatar name={displayName(me)} />
            <span>
              <strong>{displayName(me)}</strong>
              <small>{me.positions.map(p => p.title).join(", ") || (me.is_admin ? "System Administrator" : "No position yet")}</small>
            </span>
          </Link>
          <form action={logout}><button type="submit" className="os-signout">Sign out</button></form>
        </>
      )}
    >
      {children}
    </Shell>
  );
}
