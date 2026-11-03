import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { Upload } from "@/components/os/Upload";
import { Page } from "@/components/os/ui";
import { removeWeeklySummaryPhoto, saveWeeklySummary } from "@/lib/os/actions/summary";
import { requireMe } from "@/lib/os/dal";
import { dueLong } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";
import { SUMMARY_SECTIONS, summaryWeek } from "@/lib/os/summary";

export const metadata: Metadata = { title: "Weekly summary" };

const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default async function WeeklySummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data: summary }, { data: task }, { data: files }] = await Promise.all([
    supabase.from("weekly_summaries").select("*").eq("task_id", id).maybeSingle(),
    supabase.from("tasks").select("assigned_to, due_at").eq("id", id).maybeSingle(),
    supabase.from("attachments").select("id, file_name").eq("entity_type", "task").eq("entity_id", id).not("confirmed_at", "is", null).in("content_type", PHOTO_TYPES).order("created_at"),
  ]);
  if (!summary || !task) notFound();
  if (summary.sent_at || task.assigned_to !== me.id) redirect(`/os/summaries/${id}/review`);

  return (
    <Page title="Write the weekly summary" eyebrow="Weekly summaries" subtitle={`Week of ${summaryWeek(summary.week_start)}. Due ${dueLong(task.due_at)}`}>
      <div className="os-summary">
        <ActionForm action={saveWeeklySummary} className="os-stack-lg" ariaLabel="Weekly summary">
          <input type="hidden" name="id" value={id} />
          {SUMMARY_SECTIONS.map(section => (
            <section key={section.key} className="os-panel">
              <label htmlFor={section.key} className="os-summary-title">{section.title}</label>
              <ul id={`${section.key}-questions`} className="os-summary-questions">
                {section.questions.map(q => <li key={q}>{q}</li>)}
              </ul>
              <textarea id={section.key} name={section.key} rows={8} maxLength={20000} defaultValue={summary[section.key]} aria-describedby={`${section.key}-questions`} />
            </section>
          ))}
          <div className="os-row os-wrap">
            <SubmitButton name="intent" value="review">Review draft</SubmitButton>
            <SubmitButton variant="ghost" name="intent" value="save">Save draft</SubmitButton>
            <Link className="os-link" href="/os">Back to My tasks</Link>
          </div>
        </ActionForm>

        <section className="os-panel" aria-labelledby="photos">
          <div className="os-panel-head">
            <h2 id="photos">Photos</h2>
            <Upload type="task" entity={id} accept=".png,.jpg,.jpeg,.webp" label="Add photos" multiple />
          </div>
          {files?.length ? (
            <ul className="os-summary-photos">
              {files.map(photo => (
                <li key={photo.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a one-minute signed link, which the image optimizer can't fetch */}
                  <img src={`/os/attachments/${photo.id}?view=1`} alt={photo.file_name} />
                  <ActionForm action={removeWeeklySummaryPhoto} ariaLabel={`Remove ${photo.file_name}`}>
                    <input type="hidden" name="photo" value={photo.id} />
                    <button type="submit" className="os-link-btn os-danger-link">Remove</button>
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : <p className="os-muted">Add photos from this week to include with your email.</p>}
        </section>
      </div>
    </Page>
  );
}
