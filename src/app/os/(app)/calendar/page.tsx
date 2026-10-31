import type { Metadata } from "next";
import { Calendar } from "@/components/os/Calendar";
import { CalendarTabs } from "./tabs";
import { Page } from "@/components/os/ui";
import { requireMe } from "@/lib/os/dal";

export const metadata: Metadata = { title: "My Calendar" };

export default async function MyCalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; show?: string | string[] }> }) {
  const me = await requireMe();
  return (
    <Page title="My Calendar">
      <CalendarTabs current="personal" me={me} />
      <Calendar scope="personal" basePath="/os/calendar" searchParams={await searchParams} />
    </Page>
  );
}
