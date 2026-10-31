import { SopTable } from "@/components/os/SopTable";
import { Panel } from "@/components/os/ui";
import { getDepartments } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";

export default async function AdminSops() {
  const supabase = await createClient();
  const [{ data }, departments] = await Promise.all([supabase.from("sops").select("*").order("archived_at", { nullsFirst: true }).order("title"), getDepartments()]);
  const nameOf = (id: string) => departments.find(d => d.id === id)?.name ?? "";
  return <Panel title="Every SOP, archived ones included"><SopTable sops={data ?? []} departmentName={nameOf} /></Panel>;
}
