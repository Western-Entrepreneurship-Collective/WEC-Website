import type { Metadata } from "next";
import { Calendar } from "@/components/os/Calendar";
import { requireMe } from "@/lib/os/dal";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; scope?: string }> }) {
  const me = await requireMe();
  return <div className="os-page"><Calendar wide={me.is_president || me.is_admin ? "org" : "core"} params={await searchParams} /></div>;
}
