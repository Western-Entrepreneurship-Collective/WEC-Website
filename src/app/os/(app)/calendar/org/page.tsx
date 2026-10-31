import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calendar } from "@/components/os/Calendar";
import { Page } from "@/components/os/ui";
import { requireMe } from "@/lib/os/dal";
import { CalendarTabs } from "../tabs";

export const metadata: Metadata = { title: "Organization Calendar" };

export default async function OrgCalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; show?: string | string[] }> }) {
  const me = await requireMe();
  if (!me.is_president && !me.is_admin) notFound();
  return (
    <Page title="Organization Calendar">
      <CalendarTabs current="org" me={me} />
      <Calendar scope="org" basePath="/os/calendar/org" searchParams={await searchParams} />
    </Page>
  );
}
