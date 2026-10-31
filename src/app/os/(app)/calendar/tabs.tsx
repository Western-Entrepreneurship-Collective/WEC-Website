import { Tabs } from "@/components/os/ui";
import type { Me } from "@/lib/os/types";

export const CalendarTabs = ({ current, me }: { current: string; me: Me }) => (
  <Tabs current={current} items={[
    { key: "personal", href: "/os/calendar", label: "Mine" },
    { key: "core", href: "/os/calendar/core", label: "Core" },
    ...(me.is_president || me.is_admin ? [{ key: "org", href: "/os/calendar/org", label: "Organization" }] : []),
  ]} />
);
