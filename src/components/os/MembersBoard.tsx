"use client";

import { useMemo, useState } from "react";
import { logMemberExport, type ExportDetail, type ExportKind } from "@/lib/os/actions/members";
import "@/styles/os-members.css";

export type Member = { id: string; name: string; email: string; year: string; joined_at: string };

// The years the member list stores, in the order people think of them.
const YEARS = [
  { value: "Year 1", label: "1st year" },
  { value: "Year 2", label: "2nd year" },
  { value: "Year 3", label: "3rd year" },
  { value: "Year 4", label: "4th year" },
  { value: "Year 5+", label: "5th year +" },
  { value: "Graduate", label: "Graduate" },
  { value: "Alumni", label: "Alumni" },
  { value: "Unknown", label: "Year unknown" },
];
const SIZES = [25, 50, 100];

/** The clipboard API first; the older copy command where a browser blocks it. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const done = document.execCommand("copy");
    area.remove();
    if (!done) throw new Error("copy blocked");
  }
}

const joined = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
// A cell starting with = + - @ or a tab/return would run as a formula in Excel or
// Google Sheets (names come from the public join form), so it gets a leading ' first.
const csvCell = (s: string) => `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;

/**
 * The member list for whoever holds members.view. The site sends nothing: a batch is
 * copied for the BCC line of the person's own email. The page only opens after the
 * one-time agreement (MemberPolicyGate); every copy or download is logged by count and
 * year filter, never by address or search text.
 */
export function MembersBoard({ members, logExport = logMemberExport }: { members: Member[]; logExport?: typeof logMemberExport }) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string | null>(null);
  const [size, setSize] = useState(50);
  const [copied, setCopied] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of members) c[m.year] = (c[m.year] ?? 0) + 1;
    return c;
  }, [members]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(m => (!year || m.year === year) && (!q || m.name.toLowerCase().includes(q) || m.email.includes(q)));
  }, [members, query, year]);

  const batches = useMemo(() => {
    const out: Member[][] = [];
    for (let i = 0; i < shown.length; i += size) out.push(shown.slice(i, i + size));
    return out;
  }, [shown, size]);

  // Changing what is showing makes old "copied" marks meaningless.
  const filterKey = `${year ?? "all"}|${query.trim().toLowerCase()}|${size}`;
  async function record(kind: ExportKind, count: number, batch: number | null) {
    // Fixed fields only. Never the search text: someone may search by an address.
    const detail: ExportDetail = { year, search: Boolean(query.trim()), batch, batches: batch ? batches.length : null };
    const r = await logExport(kind, count, detail);
    if (!r.ok) setNotice({ kind: "error", text: `${kind === "csv" ? "Downloaded" : "Copied"}, but it could not be recorded in the log. Let the VP Operations know.` });
  }

  async function copyBatch(i: number) {
    const batch = batches[i];
    try {
      await copyText(batch.map(m => m.email).join("; "));
    } catch {
      setNotice({ kind: "error", text: "Your browser blocked copying. Try again, or use Download CSV." });
      return;
    }
    const at = new Date().toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
    setCopied(c => ({ ...c, [`${filterKey}|${i}`]: at }));
    setNotice({ kind: "ok", text: `Batch ${i + 1} copied (${batch.length} addresses). Paste it into BCC, never To or CC.` });
    await record("copy", batch.length, i + 1);
  }

  async function downloadCsv() {
    const rows = [["Name", "Email", "Year"], ...shown.map(m => [m.name, m.email, m.year])];
    const blob = new Blob([rows.map(r => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `WEC-members-${new Date().toISOString().slice(0, 10)}-DELETE-AFTER-USE.csv`;
    link.click();
    // Later, not at once: some browsers cancel a download whose address is revoked too soon.
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    setNotice({ kind: "ok", text: `Downloaded ${shown.length} members. Delete the file once you're done with it.` });
    await record("csv", shown.length, null);
  }

  return (
    <div className="os-members">

      <div className="os-members-tools">
        <input
          type="search" className="os-input" placeholder="Search by name or email" aria-label="Search members"
          value={query} onChange={e => setQuery(e.target.value)}
        />
        <label className="os-members-size">
          Batch size
          <select className="os-input" value={size} onChange={e => setSize(Number(e.target.value))}>
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <nav className="os-overview-filter" aria-label="Filter by year">
        <button type="button" aria-current={year ? undefined : "page"} onClick={() => setYear(null)}>All ({members.length})</button>
        {YEARS.filter(y => counts[y.value]).map(y => (
          <button key={y.value} type="button" aria-current={year === y.value ? "page" : undefined} onClick={() => setYear(y.value)}>
            {y.label} ({counts[y.value]})
          </button>
        ))}
      </nav>

      <div className="os-members-summary">
        <p><strong>{shown.length}</strong> {shown.length === 1 ? "member" : "members"} showing, in {batches.length} {batches.length === 1 ? "batch" : "batches"} of up to {size}.</p>
        <button type="button" className="os-btn os-btn-ghost" onClick={downloadCsv} disabled={!shown.length}>Download CSV</button>
      </div>

      {notice ? <p className={notice.kind === "error" ? "os-form-error" : "os-members-ok"} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p> : null}

      {shown.length === 0 ? <p className="os-muted">No members match.</p> : null}

      {batches.map((batch, i) => {
        const mark = copied[`${filterKey}|${i}`];
        return (
          <section key={`${filterKey}|${i}`} className="os-panel os-members-batch">
            <header className="os-panel-head">
              <h2>Batch {i + 1} <small>members {i * size + 1} to {i * size + batch.length}</small></h2>
              <span className="os-members-copy">
                {mark ? <small>Copied {mark}</small> : null}
                <button type="button" className="os-btn os-btn-primary" onClick={() => copyBatch(i)}>{mark ? "Copy again" : "Copy for BCC"}</button>
              </span>
            </header>
            <table className="os-members-table">
              <thead><tr><th>Name</th><th>Email</th><th>Year</th><th>Joined</th></tr></thead>
              <tbody>
                {batch.map(m => (
                  <tr key={m.id}><td>{m.name}</td><td>{m.email}</td><td>{YEARS.find(y => y.value === m.year)?.label ?? m.year}</td><td>{joined(m.joined_at)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
