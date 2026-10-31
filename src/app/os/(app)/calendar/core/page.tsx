import type { Metadata } from "next";
import { Calendar } from "@/components/os/Calendar";
import { Page } from "@/components/os/ui";
import { requireMe } from "@/lib/os/dal";
import { CalendarTabs } from "../tabs";

export const metadata: Metadata = { title: "Core Calendar" };

export default async function CoreCalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; show?: string | string[] }> }) {
  const me = await requireMe();
  return (
    <Page title="Core Calendar">
      <CalendarTabs current="core" me={me} />
      <Calendar scope="core" basePath="/os/calendar/core" searchParams={await searchParams} />
    </Page>
  );
}
