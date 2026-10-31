import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page } from "@/components/os/ui";
import { can, getDepartments, getDirectory, requireMe } from "@/lib/os/dal";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "New event proposal" };

export default async function NewEventPage() {
  const me = await requireMe();
  if (!can(me, "event.submit")) notFound();
  return <Page title="New event proposal"><EventForm departments={await getDepartments()} people={await getDirectory()} leads={[me.id]} /></Page>;
}
