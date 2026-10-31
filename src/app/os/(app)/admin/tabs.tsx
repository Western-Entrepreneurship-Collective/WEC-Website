"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/os/ui";

const SECTIONS = [["", "Overview"], ["executives", "Executives"], ["org", "Departments"], ["permissions", "Permissions"], ["templates", "Templates"], ["automation", "Automation"], ["jobs", "Jobs"], ["sops", "SOPs"], ["audit", "Audit log"], ["years", "Academic years"], ["archives", "Archives"], ["settings", "Settings"]];

export function AdminTabs() {
  const pathname = usePathname();
  const current = pathname.replace("/os/admin", "").split("/")[1] ?? "";
  return <Tabs current={current} items={SECTIONS.map(([key, label]) => ({ key, label, href: key ? `/os/admin/${key}` : "/os/admin" }))} />;
}
