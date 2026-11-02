import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Field, Page, Panel } from "@/components/os/ui";
import { requireMe } from "@/lib/os/dal";
import { lineDiff } from "@/lib/os/diff";
import { createClient } from "@/lib/os/supabase";

export const metadata: Metadata = { title: "Compare versions" };

export default async function ComparePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string; b?: string }> }) {
  await requireMe();
  const { id } = await params;
  const { a, b } = await searchParams;
  const supabase = await createClient();
  const [{ data: sop }, { data: versions }] = await Promise.all([
    supabase.from("sops").select("title").eq("id", id).maybeSingle(),
    supabase.from("sop_versions").select("*").eq("sop_id", id).order("major").order("minor"),
  ]);
  if (!sop || !versions?.length) notFound();
  const older = versions.find(v => v.id === a) ?? versions[Math.max(versions.length - 2, 0)];
  const newer = versions.find(v => v.id === b) ?? versions[versions.length - 1];
  const rows = lineDiff(older.content, newer.content);
  return (
    <Page eyebrow={sop.title} title="Compare versions">
      <form action={`/os/sops/${id}/compare`} className="os-inline-form">
        <Field label="From"><select name="a" defaultValue={older.id}>{versions.map(v => <option key={v.id} value={v.id}>{v.major}.{v.minor}</option>)}</select></Field>
        <Field label="To"><select name="b" defaultValue={newer.id}>{versions.map(v => <option key={v.id} value={v.id}>{v.major}.{v.minor}</option>)}</select></Field>
        <button className="os-btn os-btn-ghost" type="submit">Compare</button>
      </form>
      <Panel title={`${older.major}.${older.minor} to ${newer.major}.${newer.minor}`}>
        <div className="os-diff">
          {rows.map((r, i) => <div key={i} className={`os-diff-${r.kind}`}><span aria-hidden="true">{r.kind === "add" ? "+" : r.kind === "del" ? "−" : " "}</span><span className="sr-only">{r.kind === "add" ? "Added: " : r.kind === "del" ? "Removed: " : ""}</span>{r.text || " "}</div>)}
        </div>
      </Panel>
    </Page>
  );
}
