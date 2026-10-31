import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Hidden, Page, Panel, Pill } from "@/components/os/ui";
import { startSopDraft } from "@/lib/os/actions/knowledge";
import { inDepartment, requireMe } from "@/lib/os/dal";
import { formatDate } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "SOP version" };

export default async function SopVersionPage({ params }: { params: Promise<{ id: string; versionId: string }> }) {
  const me = await requireMe();
  const { id, versionId } = await params;
  const supabase = await createClient();
  const [{ data: v }, { data: sop }] = await Promise.all([
    supabase.from("sop_versions").select("*").eq("id", versionId).eq("sop_id", id).maybeSingle(),
    supabase.from("sops").select("*").eq("id", id).maybeSingle(),
  ]);
  if (!v || !sop) notFound();
  const manages = !sop.archived_at && (me.is_president || me.is_admin || inDepartment(me, sop.department_id));
  return (
    <Page eyebrow={sop.title} title={`Version ${v.major}.${v.minor}`} actions={<><Pill value={v.status} /><Link className="os-btn os-btn-ghost" href={`/os/sops/${id}`}>Back to SOP</Link></>}>
      {v.published_at ? <p className="os-muted">Published {formatDate(v.published_at)}. This version cannot be changed.</p> : null}
      <Panel><div className="os-doc">{v.content || <span className="os-muted">This version is empty.</span>}</div></Panel>
      {manages && v.status === "superseded" ? (
        <ActionForm action={startSopDraft} className="os-row"><Hidden name="id" value={id} /><Hidden name="from" value={versionId} /><Hidden name="major" value="true" /><SubmitButton variant="ghost">Restore this content as a new version</SubmitButton></ActionForm>
      ) : null}
    </Page>
  );
}
