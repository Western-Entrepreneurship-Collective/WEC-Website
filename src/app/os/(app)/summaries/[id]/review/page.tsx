import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/os/ActionForm";
import { SummarySend } from "@/components/os/SummarySend";
import { Page } from "@/components/os/ui";
import { markWeeklySummarySent } from "@/lib/os/actions/summary";
import { getDirectory, requireMe } from "@/lib/os/dal";
import { formatDateTime, torontoDateKey } from "@/lib/os/format";
import { createClient } from "@/lib/os/supabase";
import { paragraphs, SUMMARY_SECTIONS, summaryEmail, summaryWeek } from "@/lib/os/summary";

export const metadata: Metadata = { title: "Review weekly summary" };

const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default async function ReviewWeeklySummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data: summary }, { data: task }, { data: files }, { data: seated }, directory] = await Promise.all([
    supabase.from("weekly_summaries").select("*").eq("task_id", id).maybeSingle(),
    supabase.from("tasks").select("assigned_to").eq("id", id).maybeSingle(),
    supabase.from("attachments").select("id, file_name").eq("entity_type", "task").eq("entity_id", id).not("confirmed_at", "is", null).in("content_type", PHOTO_TYPES).order("created_at"),
    // Everyone who holds a position, including anyone who hasn't signed in yet.
    supabase.from("position_assignments").select("executive_id, during"),
    getDirectory(),
  ]);
  if (!summary || !task) notFound();

  const photos = (files ?? []).map(f => ({ id: f.id, name: f.file_name }));
  const today = torontoDateKey(new Date());
  const holders = new Set((seated ?? []).filter(a => {
    const upper = String(a.during).split(",")[1]?.replace(/[)\]]/, "");
    return !upper || upper > today;
  }).map(a => a.executive_id));
  const addresses = directory.filter(p => holders.has(p.id) && p.status !== "deactivated").map(p => p.email);
  const email = summaryEmail(summary.week_start, summary);
  const mine = task.assigned_to === me.id;
  const editable = mine && !summary.sent_at;

  return (
    <Page
      title={editable ? "Review your draft" : "Weekly summary"}
      subtitle={summary.sent_at ? `Marked as sent ${formatDateTime(summary.sent_at)}` : editable ? "When it looks right, send it to the executive team from your own email. The site doesn't send anything." : "Still being written."}
    >
      <div className="os-summary">
        <article className="os-panel os-summary-letter">
          <header>
            <h2>Weekly Summary</h2>
            <p>Week of {summaryWeek(summary.week_start)}</p>
          </header>
          {SUMMARY_SECTIONS.map(section => (
            <section key={section.key}>
              <h3>{section.title}</h3>
              {paragraphs(summary[section.key]).map((p, i) => <p key={i}>{p}</p>)}
            </section>
          ))}
          {photos.length ? (
            <section>
              <h3>Photos to attach</h3>
              <ul className="os-summary-photos">
                {photos.map(photo => (
                  <li key={photo.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a one-minute signed link, which the image optimizer can't fetch */}
                    <img src={`/os/attachments/${photo.id}?view=1`} alt={photo.name} />
                    <a className="os-link" href={`/os/attachments/${photo.id}`}>Download</a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>

        {mine ? (
          <section className="os-panel" aria-labelledby="send">
            <h2 id="send">Send it from your email</h2>
            <SummarySend addresses={addresses} subject={email.subject} html={email.html} plain={email.plain} photos={photos} />
          </section>
        ) : null}

        {editable ? (
          <div className="os-row os-wrap">
            <ActionForm action={markWeeklySummarySent} ariaLabel="Mark as sent">
              <input type="hidden" name="id" value={id} />
              <SubmitButton>Mark as sent</SubmitButton>
            </ActionForm>
            <Link className="os-btn os-btn-ghost" href={`/os/summaries/${id}`}>Keep editing</Link>
          </div>
        ) : null}
      </div>
    </Page>
  );
}
