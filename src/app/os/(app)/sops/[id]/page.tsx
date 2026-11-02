import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Upload } from "@/components/os/Upload";
import { Field, Hidden, Page, Panel, PeopleSelect, Pill } from "@/components/os/ui";
import { publishSopVersion, returnSopVersion, saveSopDraft, setSopArchived, startSopDraft, submitSopVersion, updateSop } from "@/lib/os/actions/knowledge";
import { can, getDirectory, inDepartment, nameLookup, requireMe } from "@/lib/os/dal";
import { editsSops, formatDate, formatDateTime, label } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "SOP" };

export default async function SopPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: sop } = await supabase.from("sops").select("*").eq("id", id).maybeSingle();
  if (!sop) notFound();
  const [directory, versions, approvals, projects, files] = await Promise.all([
    getDirectory(),
    supabase.from("sop_versions").select("*").eq("sop_id", id).order("major", { ascending: false }).order("minor", { ascending: false }),
    supabase.from("sop_approvals").select("*, sop_versions!inner(sop_id, major, minor)").eq("sop_versions.sop_id", id).order("created_at"),
    supabase.from("project_sop_refs").select("project_id, sop_version_id, projects(name), sop_versions!inner(sop_id, major, minor)").eq("sop_versions.sop_id", id),
    supabase.from("attachments").select("*").eq("entity_type", "sop").eq("entity_id", id),
  ]);
  const { data: templates } = await supabase.from("template_versions").select("template_id, templates!template_versions_template_id_fkey(name)").contains("definition", { sop_ids: [id] });
  const nameOf = nameLookup(directory);
  const list = versions.data ?? [];
  const current = list.find(v => v.id === sop.current_version_id);
  const draft = list.find(v => ["draft", "submitted", "approved"].includes(v.status));
  const edits = !sop.archived_at && editsSops(me, sop.department_id);
  const approves = !sop.archived_at && me.is_president;
  const archives = !sop.archived_at && (me.is_admin || (can(me, "sop.archive") && (me.is_president || inDepartment(me, sop.department_id))));

  return (
    <Page eyebrow="SOP" title={sop.title} actions={<>{sop.archived_at ? <Pill value="archived" /> : null}{current ? <span className="os-tag">v{current.major}.{current.minor}</span> : <Pill value="draft" />}</>}>
      {sop.archived_at ? <p className="os-note">This SOP is archived. Its published versions remain on record.</p> : null}
      <div className="os-split">
        <div className="os-stack-lg">
          {current ? (
            <Panel title={`Current version: ${current.major}.${current.minor}`} action={<span className="os-muted">Published {formatDate(current.published_at)}</span>}>
              <div className="os-doc">{current.content || <span className="os-muted">This version is empty.</span>}</div>
            </Panel>
          ) : null}
          {draft ? (
            <Panel title={`Draft: ${draft.major}.${draft.minor}`} action={<Pill value={draft.status} />}>
              {draft.status === "draft" && edits ? (
                <ActionForm action={saveSopDraft} className="os-stack">
                  <Hidden name="version" value={draft.id} /><Hidden name="expected" value={draft.updated_at} />
                  <Field label="Procedure"><textarea name="content" rows={14} defaultValue={draft.content} /></Field>
                  <Field label="What changed"><input name="change_note" defaultValue={draft.change_note} maxLength={500} /></Field>
                  <div><SubmitButton variant="ghost">Save draft</SubmitButton></div>
                </ActionForm>
              ) : <div className="os-doc">{draft.content}</div>}
              {draft.status === "draft" && edits && !approves ? <ActionForm action={submitSopVersion} className="os-stack"><Hidden name="version" value={draft.id} /><p className="os-muted">The President approves it before it&apos;s published.</p><div><SubmitButton>Send to the President</SubmitButton></div></ActionForm> : null}
              {draft.status !== "draft" && !approves ? <p className="os-muted">Waiting for the President to approve it.</p> : null}
              {draft.status === "draft" && approves && draft.author_id !== me.id ? <p className="os-muted">Waiting for the person who wrote it to send it for approval.</p> : null}
              {(draft.status !== "draft" || draft.author_id === me.id) && approves ? (
                <div className="os-stack">
                  <ActionForm action={publishSopVersion} confirm={`Publish version ${draft.major}.${draft.minor}? The current version is kept in the history, and this one cannot be changed afterwards.`}><Hidden name="version" value={draft.id} /><SubmitButton>Approve and publish</SubmitButton></ActionForm>
                  {draft.status === "draft" ? null : <ActionForm action={returnSopVersion} className="os-inline-form"><Hidden name="version" value={draft.id} /><Field label="Send back with a note"><input name="note" required /></Field><SubmitButton variant="ghost">Send back</SubmitButton></ActionForm>}
                </div>
              ) : null}
            </Panel>
          ) : null}
          {!draft && edits && current ? (
            <Panel title="Revise">
              <div className="os-row os-wrap">
                <ActionForm action={startSopDraft}><Hidden name="id" value={id} /><SubmitButton variant="ghost">Start minor revision</SubmitButton></ActionForm>
                <ActionForm action={startSopDraft}><Hidden name="id" value={id} /><Hidden name="major" value="true" /><SubmitButton variant="ghost">Start major revision</SubmitButton></ActionForm>
              </div>
            </Panel>
          ) : null}
        </div>
        <div className="os-stack-lg">
          <Panel title="Details">
            {sop.description ? <p className="os-pre">{sop.description}</p> : null}
            <dl className="os-dl">
              <div><dt>Responsible</dt><dd>{nameOf(sop.responsible_executive_id)}</dd></div>
              <div><dt>Review by</dt><dd>{formatDate(sop.review_on)}</dd></div>
              <div><dt>Readable by</dt><dd>{label(sop.visibility)}</dd></div>
            </dl>
          </Panel>
          <Panel title="Revision history" action={list.filter(v => v.published_at).length > 1 ? <Link className="os-link" href={`/os/sops/${id}/compare`}>Compare</Link> : null}>
            <ul className="os-list">
              {list.map(v => (
                <li key={v.id}>
                  <span><Link href={`/os/sops/${id}/versions/${v.id}`}>{v.major}.{v.minor}</Link> <span className="os-muted">{nameOf(v.author_id)}{v.change_note ? ` · ${v.change_note}` : ""}</span></span>
                  <Pill value={v.status} />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Approval history">
            {(approvals.data ?? []).length === 0 ? <p className="os-muted">Nothing yet.</p> : (
              <ul className="os-timeline">{(approvals.data ?? []).map(a => <li key={a.id}><span className="os-muted">{formatDateTime(a.created_at)}</span>v{a.sop_versions.major}.{a.sop_versions.minor} {label(a.decision)} by {nameOf(a.actor_id)}{a.note ? `: ${a.note}` : ""}</li>)}</ul>
            )}
          </Panel>
          <Panel title="Used by">
            {(projects.data ?? []).length === 0 && (templates ?? []).length === 0 ? <p className="os-muted">No linked projects or templates you can see.</p> : (
              <ul className="os-list">
                {(projects.data ?? []).map(r => <li key={r.project_id + r.sop_version_id}><Link href={`/os/projects/${r.project_id}`}>{r.projects?.name}</Link><span className="os-muted">v{r.sop_versions.major}.{r.sop_versions.minor}</span></li>)}
                {[...new Map((templates ?? []).map(t => [t.template_id, t])).values()].map(t => <li key={t.template_id}>{t.templates?.name}<span className="os-muted">Template</span></li>)}
              </ul>
            )}
          </Panel>
          <Panel title="Files">
            <ul className="os-list">{(files.data ?? []).map(a => <li key={a.id}><a className="os-link" href={`/os/attachments/${a.id}`}>{a.file_name}</a></li>)}</ul>
            {edits ? <Upload type="sop" entity={id} /> : null}
          </Panel>
          {edits ? (
            <Panel title="Manage">
              <ActionForm action={updateSop} className="os-stack">
                <Hidden name="id" value={id} /><Hidden name="expected" value={sop.updated_at} />
                <Field label="Title"><input name="title" defaultValue={sop.title} required maxLength={160} /></Field>
                <Field label="Description"><textarea name="description" rows={2} defaultValue={sop.description} /></Field>
                <Field label="Readable by"><select name="visibility" defaultValue={sop.visibility}><option value="all_execs">Every executive</option><option value="department">The department</option><option value="restricted">Restricted</option></select></Field>
                <Field label="Review by"><input name="review_on" type="date" defaultValue={sop.review_on ?? ""} /></Field>
                <PeopleSelect name="responsible" people={directory} label="Responsible" value={sop.responsible_executive_id} />
                <div><SubmitButton variant="ghost">Save</SubmitButton></div>
              </ActionForm>
            </Panel>
          ) : null}
          {archives ? <ActionForm action={setSopArchived} confirm="Archive this SOP? Published versions stay on record."><Hidden name="id" value={id} /><Hidden name="archived" value="true" /><SubmitButton variant="ghost">Archive</SubmitButton></ActionForm> : null}
        </div>
      </div>
    </Page>
  );
}
