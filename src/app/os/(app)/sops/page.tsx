import type { Metadata } from "next";
import Link from "next/link";
import { SopTable } from "@/components/os/SopTable";
import { Page } from "@/components/os/ui";
import { can, getDepartments, requireMe } from "@/lib/os/dal";
import { createClient } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "SOP Library" };

export default async function SopLibraryPage() {
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data }, departments] = await Promise.all([supabase.from("sops").select("*").order("title"), getDepartments()]);
  const nameOf = (id: string) => departments.find(d => d.id === id)?.name ?? "";
  return (
    <Page title="SOP Library" actions={can(me, "sop.create") ? <Link className="os-btn os-btn-primary" href="/os/sops/new">New SOP</Link> : null}>
      <SopTable sops={data ?? []} departmentName={nameOf} />
    </Page>
  );
}
