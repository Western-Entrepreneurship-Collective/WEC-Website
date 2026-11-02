"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [["", "Overview"], ["executives", "People"], ["org", "Teams and positions"], ["permissions", "Permissions"], ["templates", "Templates"], ["automation", "Automation"], ["jobs", "Failed jobs"], ["sops", "SOPs"], ["audit", "Audit log"], ["years", "Academic years"], ["archives", "Archives"], ["settings", "Settings"]];

export function AdminTabs() {
  const pathname = usePathname();
  const current = pathname.replace("/os/admin", "").split("/")[1] ?? "";
  return (
    <nav className="os-admin-nav" aria-label="Admin">
      {SECTIONS.map(([key, label]) => <Link key={key} href={key ? `/os/admin/${key}` : "/os/admin"} aria-current={key === current ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}
