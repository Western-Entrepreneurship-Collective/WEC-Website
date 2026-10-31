import type { Metadata } from "next";
import { Logo } from "@/components/graphics/DraftGraphics";
import { SubmitButton } from "@/components/os/ActionForm";
import { Avatar } from "@/components/os/ui";
import { finishWelcome } from "@/lib/os/actions/work";
import { displayName, requireMe } from "@/lib/os/dal";
import { getSeats } from "@/lib/os/org";

export const metadata: Metadata = { title: "Welcome" };

const ROLE_TEXT: Record<string, string> = {
  president: "You see all of WEC's work, and you approve events and Global Projects.",
  vp: "You run your team's work, assign it, and answer requests from other teams.",
  director: "You'll see your team's shared work and anything assigned to you.",
  coordinator: "You'll see your team's shared work and anything assigned to you.",
};

export default async function WelcomePage() {
  const me = await requireMe();
  const seats = await getSeats();
  const first = displayName(me).split(" ")[0];
  const position = me.positions[0];
  const team = position ? seats.filter(s => s.departmentId === position.department_id && s.execId !== me.id) : [];
  const places = [
    { title: "My work", body: "What's on your plate: your tasks, projects, calendar and anything waiting for you.", items: "Home, Tasks, Projects, Calendar, Inbox" },
    { title: position ? "My team" : "Your team", body: position ? `What ${position.department_name} is doing together: projects, requests, SOPs and meeting notes.` : "Once you hold a position, your team's work shows up here.", items: position?.department_name ?? "Assigned by an administrator" },
    { title: "Organization", body: "What all of WEC is doing: events, organization-wide projects and every team.", items: "Events, Global Projects, All Teams, SOP Library" },
  ];
  const chain = [
    { name: "Event", eg: "Founder Lab" }, { name: "Project", eg: "One for each team involved" },
    { name: "Task", eg: "Who does what, by when" }, { name: "Subtask", eg: "Optional smaller steps" },
  ];
  return (
    <div className="os-welcome">
      <header className="os-welcome-hero">
        <Logo reversed priority className="os-welcome-logo" />
        <p className="os-hand">You&apos;re in good company.</p>
        <h1>Welcome to WEC OS, {first}.</h1>
        <p className="os-welcome-lead">This is where the executive team runs events, projects and handovers. Two minutes here and you&apos;ll know your way around.</p>
      </header>
      <main className="os-welcome-body">
        <section className="os-welcome-card os-welcome-place" aria-labelledby="place">
          <div>
            <h2 id="place">Your place at WEC</h2>
            {position ? <p>You&apos;re <strong>{position.title}</strong>, on the {position.department_name} team. {ROLE_TEXT[position.org_role]}</p> : <p>{me.is_admin ? "You keep the system running: accounts, permissions, templates and automation." : "An administrator will give you a position soon."}</p>}
          </div>
          {team.length ? (
            <ul className="os-people-list">
              {team.map(s => (
                <li key={s.key}><Avatar name={s.name} lead={s.isHead} /><span><strong>{s.name ?? "Open seat"}</strong><small>{s.title}{s.isHead ? ". Leads the team" : ""}</small></span></li>
              ))}
            </ul>
          ) : null}
        </section>
        <section aria-labelledby="where">
          <h2 id="where">Everything lives in one of three places</h2>
          <div className="os-welcome-places">
            {places.map(p => <article key={p.title} className="os-welcome-card"><h3>{p.title}</h3><p>{p.body}</p><small>{p.items}</small></article>)}
          </div>
        </section>
        <section className="os-welcome-card" aria-labelledby="how">
          <h2 id="how">How work fits together</h2>
          <ol className="os-chain">{chain.map(c => <li key={c.name}><strong>{c.name}</strong><small>{c.eg}</small></li>)}</ol>
          <p>Need something from another team? Send a request. Their lead accepts it and picks who does it, and both teams see the same status.</p>
        </section>
        <form action={finishWelcome} className="os-row os-wrap">
          <SubmitButton>Take me to my Home</SubmitButton>
          <span className="os-muted">You can reopen this any time from your profile.</span>
        </form>
      </main>
    </div>
  );
}
