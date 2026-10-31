"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { setTaskStatus } from "@/lib/os/actions/work";
import { label } from "@/lib/os/format";

type Card = { id: string; title: string; status: string; priority: string; assignee?: string; due?: string; is_cross_team: boolean; requires_review: boolean; updated_at: string };

const COLUMNS = ["todo", "in_progress", "blocked", "submitted", "done"] as const;
// Moves with their own workflow are read-only here and happen on the task page.
const MOVABLE = new Set<string>(["todo", "in_progress", "blocked", "done"]);

/** Drag between columns, or use the select on any card: keyboard users get the same move. */
export function Kanban({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  function move(card: Card, status: string) {
    if (card.status === status) return;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("id", card.id);
      fd.set("status", status);
      fd.set("expected", card.updated_at);
      const result = await setTaskStatus(null, fd);
      if (!result.ok) setError(result.error ?? "That move did not work.");
      router.refresh();
    });
  }

  const unassigned = cards.filter(c => c.status === "unassigned");
  return (
    <div aria-busy={pending}>
      {error ? <p className="os-form-error" role="alert">{error}</p> : null}
      {unassigned.length ? <p className="os-muted">{unassigned.length} waiting to be assigned: {unassigned.slice(0, 5).map((c, i) => <span key={c.id}>{i ? ", " : ""}<Link className="os-link" href={`/os/tasks/${c.id}`}>{c.title}</Link></span>)}</p> : null}
      <div className="os-kanban" tabIndex={0} role="group" aria-label="Task board">
        {COLUMNS.map(column => (
          <section
            key={column}
            className="os-kanban-col"
            aria-label={label(column)}
            onDragOver={e => { if (MOVABLE.has(column)) e.preventDefault(); }}
            onDrop={() => {
              const card = cards.find(c => c.id === dragging);
              if (card && MOVABLE.has(column)) move(card, column);
              setDragging(null);
            }}
          >
            <h3>{label(column)} <span>{cards.filter(c => c.status === column || (column === "todo" && c.status === "revisions_requested")).length}</span></h3>
            {cards.filter(c => c.status === column || (column === "todo" && c.status === "revisions_requested")).map(card => (
              <article key={card.id} className="os-card" draggable onDragStart={() => setDragging(card.id)}>
                <Link href={`/os/tasks/${card.id}`}>{card.title}</Link>
                <p>{card.assignee ? `${card.assignee} · ` : ""}{card.due ?? "No date"}{card.priority === "high" || card.priority === "urgent" ? ` · ${label(card.priority)}` : ""}</p>
                {card.is_cross_team ? <span className="os-tag">Cross-team</span> : null}
                <label className="os-card-move">
                  <span className="sr-only">Move {card.title} to</span>
                  <select value={card.status} onChange={e => move(card, e.target.value)} disabled={pending}>
                    {!MOVABLE.has(card.status) ? <option value={card.status}>{label(card.status)}</option> : null}
                    {[...MOVABLE].filter(s => !(s === "done" && card.requires_review)).map(s => <option key={s} value={s}>{label(s)}</option>)}
                  </select>
                </label>
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
