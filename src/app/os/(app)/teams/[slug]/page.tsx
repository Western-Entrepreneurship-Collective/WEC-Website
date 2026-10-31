import Link from "next/link";
import { Avatar, Due, Progress, Section, Status } from "@/components/os/ui";
import { projectHealth } from "@/components/os/ProjectTable";
import { can, getDirectory, nameLookup } from "@/lib/os/dal";
import { formatDate, label, projectKindHelp } from "@/lib/os/format";
import { getSeats } from "@/lib/os/org";
import { createClient, rpc } from "@/lib/os/supabase";
import type { ProjectSummary } from "@/lib/os/types";
import { getTeam } from "./team";

export default async function TeamDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { me, department, canOpen } = await getTeam(slug);
  const supabase = await createClient();
  const seats = (await getSeats()).filter(s => s.departmentId === department.id);
  const lead = seats.find(s => s.isHead);

  // Someone from another team: who to ask, how this team works, and their own
  // requests here. This team's projects and tasks stay private.
  if (!canOpen) {
    const mine = me.positions.map(p => p.department_id);
    const [{ data: sops }, { data: requests }] = await Promise.all([
      supabase.from("sops").select("id, title, review_on").eq("department_id", department.id).is("archived_at", null).not("current_version_id", "is", null).order("title"),
      mine.length ? supabase.from("tasks").select("*").eq("responsible_department_id", department.id).in("requesting_department_id", mine).eq("is_cross_team", true).order("updated_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
    ]);
    const nameOf = nameLookup(await getDirectory());
    return (
      <div className="os-split">
        <div className="os-stack-lg">
          {department.description ? <p className="os-body">{department.description}</p> : null}
          {can(me, "request.create") && mine.length ? <div><Link className="os-btn os-btn-primary" href={`/os/requests/new?to=${department.id}`}>Ask {department.name} for something</Link></div> : null}
          {(requests ?? []).length ? (
            <Section title={`Your team's requests to ${department.name}`}>
              <ul className="os-rows">
                {(requests ?? []).map(t => (
                  <li key={t.id}>
                    <Link href={`/os/tasks/${t.id}`}>{t.title}</Link>
                    <Status tone={t.status === "done" ? "good" : t.status === "cancelled" ? "plain" : "info"}>{t.request_state === "accepted" ? `${label(t.status)}${t.assigned_to ? `, ${nameOf(t.assigned_to)} has it` : ""}` : label(t.request_state)}</Status>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          <Section title={`How ${department.name} works`}>
            {(sops ?? []).length === 0 ? <p className="os-empty">No SOPs you can read yet.</p> : <ul className="os-rows">{(sops ?? []).map(s => <li key={s.id}><Link href={`/os/sops/${s.id}`}>{s.title}</Link></li>)}</ul>}
          </Section>
          <p className="os-muted">{department.name}&apos;s own projects, tasks and meeting notes are private to the team and the President.</p>
        </div>
        <aside className="os-panel">
          <h2>People</h2>
          <ul className="os-people-list">
            {seats.map(s => <li key={s.key}><Avatar name={s.name} lead={s.isHead} /><span><strong>{s.name ?? "Open seat"}</strong><small>{s.title}{s.isHead ? ", receives requests" : ""}</small></span></li>)}
          </ul>
          {!lead?.name ? <p className="os-muted">With no lead right now, requests to this team go to the President.</p> : null}
        </aside>
      </div>
    );
  }

  const [projects, incoming, outgoing, open, sops, meetings, directory] = await Promise.all([
    rpc<ProjectSummary[]>("project_summaries", { p_department: department.id }),
    supabase.from("tasks").select("*").eq("responsible_department_id", department.id).in("request_state", ["pending", "clarification_requested"]).order("created_at").limit(10),
    supabase.from("tasks").select("*").eq("requesting_department_id", department.id).eq("is_cross_team", true).not("status", "in", "(done,cancelled)").order("due_at", { nullsFirst: false }).limit(10),
    supabase.from("tasks").select("id, title, due_at, assigned_to, status, blocked_auto").eq("responsible_department_id", department.id).not("status", "in", "(done,cancelled)").order("due_at", { nullsFirst: false }).limit(200),
    supabase.from("sops").select("id, title").eq("department_id", department.id).is("archived_at", null).order("title").limit(5),
    supabase.from("meetings").select("id, title, starts_at").eq("department_id", department.id).order("starts_at", { ascending: false }).limit(3),
    getDirectory(),
  ]);
  const nameOf = nameLookup(directory);
  const openTasks = open.data ?? [];
  const late = openTasks.filter(t => t.due_at && new Date(t.due_at) < new Date()).length;
  const waitingOnUs = incoming.data ?? [];
  const lines = [
    waitingOnUs.length ? `${waitingOnUs.length} request${waitingOnUs.length === 1 ? " is" : "s are"} waiting on your team.` : null,
    late ? `${late} task${late === 1 ? " is" : "s are"} running late.` : null,
  ].filter(Boolean);
  return (
    <>
      <p className="os-page-sub">{department.description} {lines.join(" ") || "Nothing is late, and no requests are waiting."}</p>
      <div className="os-split">
        <div className="os-stack-lg">
          {waitingOnUs.length ? (
            <Section title="Waiting on us" action={<Link className="os-link" href={`/os/teams/${slug}/requests`}>All requests</Link>}>
              <ul className="os-needs">
                {waitingOnUs.map(t => (
                  <li key={t.id} className="os-need">
                    <div><Link className="os-need-title" href={`/os/tasks/${t.id}`}>{t.title}</Link><small>{t.request_state === "pending" ? "Another team is asking for this" : "Waiting on an answer to your question"}</small></div>
                    {t.due_at ? <Due value={t.due_at} /> : null}
                    <Link className="os-btn os-btn-primary" href={`/os/tasks/${t.id}`} aria-label={`Answer: ${t.title}`}>Answer</Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          <Section title="Projects" action={<Link className="os-link" href={`/os/teams/${slug}/projects`}>All</Link>}>
            {projects.length === 0 ? <p className="os-empty">No projects yet. Approved events and new internal projects show up here.</p> : (
              <ul className="os-rows os-project-rows">
                {projects.map(p => {
                  const h = projectHealth(p);
                  return (
                    <li key={p.id}>
                      <span><Link href={`/os/projects/${p.id}`}>{p.name}</Link><small className="os-block os-muted">{label(p.kind)}. {projectKindHelp[p.kind]}.</small></span>
                      <span className="os-list-side"><Progress value={p.progress} /><span className="os-muted">{p.progress}%</span></span>
                      <Status tone={h.tone}>{h.text}</Status>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
          {(outgoing.data ?? []).length ? (
            <Section title="Waiting on other teams">
              <ul className="os-rows">
                {(outgoing.data ?? []).map(t => <li key={t.id}><Link href={`/os/tasks/${t.id}`}>{t.title}</Link><span className="os-muted">{t.request_state === "accepted" ? `${label(t.status)}${t.assigned_to ? `, ${nameOf(t.assigned_to)} has it` : ""}` : label(t.request_state)}</span></li>)}
              </ul>
            </Section>
          ) : null}
        </div>
        <aside className="os-stack-lg">
          <section className="os-panel">
            <h2>Who has what</h2>
            <ul className="os-people-list">
              {seats.map(s => {
                const count = openTasks.filter(t => t.assigned_to === s.execId).length;
                const overdue = openTasks.filter(t => t.assigned_to === s.execId && t.due_at && new Date(t.due_at) < new Date()).length;
                return <li key={s.key}><Avatar name={s.name} lead={s.isHead} /><span><strong>{s.name ?? "Open seat"}{s.execId === me.id ? " (you)" : ""}</strong><small className={overdue ? "os-overdue" : undefined}>{overdue ? `${overdue} overdue` : s.title}</small></span>{s.name ? <em className="os-count">{count}</em> : null}</li>;
              })}
            </ul>
          </section>
          <Section title="Team knowledge">
            {(sops.data ?? []).length === 0 && (meetings.data ?? []).length === 0 ? <p className="os-empty">SOPs and meeting notes you add show up here.</p> : (
              <ul className="os-rows">
                {(sops.data ?? []).map(s => <li key={s.id}><Link href={`/os/sops/${s.id}`}>{s.title}</Link><small className="os-muted">SOP</small></li>)}
                {(meetings.data ?? []).map(m => <li key={m.id}><Link href={`/os/meetings/${m.id}`}>{m.title}</Link><small className="os-muted">{formatDate(m.starts_at)}</small></li>)}
              </ul>
            )}
          </Section>
        </aside>
      </div>
    </>
  );
}
