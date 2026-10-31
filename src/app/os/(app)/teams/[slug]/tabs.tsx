"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/os/ui";

export function TeamTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/os/teams/${slug}`;
  const current = pathname === base ? "dashboard" : pathname.slice(base.length + 1).split("/")[0];
  return <Tabs current={current} items={[
    { key: "dashboard", href: base, label: "Overview" },
    { key: "projects", href: `${base}/projects`, label: "Projects" },
    { key: "tasks", href: `${base}/tasks`, label: "Tasks" },
    { key: "calendar", href: `${base}/calendar`, label: "Calendar" },
    { key: "requests", href: `${base}/requests`, label: "Requests" },
    { key: "sops", href: `${base}/sops`, label: "SOPs" },
    { key: "meetings", href: `${base}/meetings`, label: "Meetings" },
  ]} />;
}
