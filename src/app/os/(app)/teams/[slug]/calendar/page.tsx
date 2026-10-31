import { notFound } from "next/navigation";
import { Calendar } from "@/components/os/Calendar";
import { getTeam } from "../team";

export default async function TeamCalendar({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ view?: string; date?: string; show?: string | string[] }> }) {
  const { slug } = await params;
  const { department, canOpen } = await getTeam(slug);
  if (!canOpen) notFound();
  return <Calendar scope="team" department={department.id} basePath={`/os/teams/${slug}/calendar`} searchParams={await searchParams} />;
}
