import { notFound } from "next/navigation";
import { SopTable } from "@/components/os/SopTable";
import { createClient } from "@/lib/os/supabase";
import { getTeam } from "../team";

export default async function TeamSops({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { department, canOpen } = await getTeam(slug);
  if (!canOpen) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("sops").select("*").eq("department_id", department.id).order("title");
  return <SopTable sops={data ?? []} />;
}
